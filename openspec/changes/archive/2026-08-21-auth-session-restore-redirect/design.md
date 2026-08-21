## Context

Boot order today (`src/main.ts`):

1. `await authStore.initialize()` → `supabase.auth.getSession()` → `currentUser`, then
   subscribe `onAuthStateChange`.
2. `if (authStore.isAuthenticated) await profileStore.loadProfile()`.
3. `watch(() => authStore.isAuthenticated, …)` — **false branch only**: clear stores,
   push `home` if the current route `requiresAuth`.
4. `setupRouterGuards(...)`, then `app.mount('#app')` → first navigation runs the guard
   once, against whatever `isAuthenticated` held at that instant.

`GoTrueClient.__loadSession` (auth-js 2.x, `dist/main/GoTrueClient.js:2320-2365`) reads
the persisted session, and if `expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS` it
awaits `_callRefreshToken`. On failure it returns `{ session: null, error }`. For a
*network* failure the error is an `AuthRetryableFetchError` and **the persisted session
stays in storage** — auth-js keeps retrying, so `TOKEN_REFRESHED` / `SIGNED_IN` arrives
seconds later. Only a permanent `AuthApiError` (invalid/revoked refresh token) triggers
`_removeSession`.

So there are two distinct broken paths, and the report ("reopen the PWA, get the email
form; press *Send code* and land on the map") is the first one:

- **A — late restore.** Refresh eventually succeeds. `isAuthenticated` flips true after
  the first navigation. The guard never re-runs (it fires on navigation only) and the
  watcher ignores the true branch, so the user is parked on `/` with a live session.
  Any navigation rescues them — which is exactly what the removed "Get Started" button
  did, and what "Send code" does now, at the price of a rate-limited OTP.
- **B — offline cold start.** Refresh can never succeed. The app boots signed out and
  the offline caches are unreachable behind a sign-in form that requires the network.

The guard itself is correct (`redirectIfAuth` on `home` and `verify-otp` → `/map`).
Nothing here changes its auth rules; D6 touches only the profile-completeness branch.

## Goals / Non-Goals

**Goals**
- A valid session reaches `/map` without user input, on every launch surface (installed
  PWA, browser tab, refresh), whether the session is restored before or after mount.
- No OTP is ever dispatched for a user who already has a session.
- An installed PWA opened offline with a persisted session boots authenticated and
  hydrates tours/profile from the offline cache, with the reduced trust of that session
  made visible.
- No edit is lost while the session is unverified: writes queue instead of being
  attempted, and replay once — and only once — the session is real. Reconnect never
  requires the user to sign in again, provided the refresh token is still valid.
- A genuinely signed-out user still gets `/` and the email form — no regression to #260.

**Non-Goals**
- No reinstatement of the "Get Started" screen, no change to the sign-in / OTP UI.
- No change to the guard's `requiresAuth` / `redirectIfAuth` rules.
- No offline *sign-in* — a user with no persisted session still needs the network.
- No custom session persistence layer or refresh scheduler; auth-js keeps owning that.
- No user-scoping of the write queue — pre-existing gap, tracked in **issue #276**.

## Decisions

### D1 — One reactive auth→navigation seam, extracted and tested

The `isAuthenticated` watcher moves **whole** out of `main.ts` into
`setupAuthRedirect(authStore, profileStore, notificationsStore, router)`, exported from
`app/router/index.ts` beside `setupRouterGuards`. Both branches move:

```
isAuth === true  → await profileStore.loadProfile()
                 → notificationsStore.ensurePushSubscription()
                 → if router.currentRoute.value.meta.redirectIfAuth → push({ name: 'map' })
isAuth === false → profileStore.clear() / notificationsStore.clear()
                 → if currentRoute.meta.requiresAuth → push({ name: 'home' })
```

- *Why not a guard change?* Guards are navigation-driven by definition; the problem is
  that no navigation occurs. A watcher is the only thing that observes a state change
  with no navigation attached.
- *Why extract?* `main.ts` runs `createApp` + `mount` on import, so an inline watcher is
  untestable. `setupRouterGuards` (`app/router/index.ts:53`) and
  `setupI18nLocaleWatcher` (`core/i18n/index.ts:22`) already establish "bootstrap wiring
  as a named setup function", and the first is tested by capturing the registered
  callback (`test/app/router/router-guards.test.ts`). Follow that; take the store
  params as structural types, as `setupRouterGuards` does, not as Pinia store types.
- *Why move both branches?* The false branch already navigates. Auth-driven navigation
  split across two files is how the next person updates one and misses the other —
  the exact shape of this bug.
- *Why gate on `meta.redirectIfAuth`?* Auth also flips true after an OTP verify and
  after a mid-session token rotation from a route deep in the app. An unconditional push
  would yank the user off their page. The gate means precisely "you are standing on a
  signed-out-only screen with a valid session".
- *Why after `loadProfile()`?* The `requiresCompleteProfile` guard reads
  `profileStore.profile`. Redirect first and it sees `null`, bouncing a complete profile
  to `/onboarding`. `loadProfile()` hydrates from IndexedDB first (`cachedLoad`), so
  offline this awaits a cache read, not a network round trip.
- *`app.use(router)` must come after both setup calls.* Installing the router **performs
  the entry navigation** as part of `install()`, so registering it before
  `setupRouterGuards` resolves the entry URL against an empty guard list: `/` renders the
  sign-in form to an authenticated user and `/map` renders without any `requiresAuth`
  check. `setupAuthRedirect` cannot rescue that either — `initialize()` has already
  settled `isAuthenticated`, and a non-`immediate` watcher never fires on a value that
  never changes. This is why the bug reproduced on `/` but not on `/map`, which looked
  like a caching problem and wasn't.

### D2 — Adopt the persisted session when the refresh fails *retryably*

In `authStore.initialize()`, when `getSession()` yields no session:

- If the error is retryable (`error.name === 'AuthRetryableFetchError'`) **or**
  `navigator.onLine === false`, adopt the persisted session's `user` into `currentUser`
  and set `sessionUnverified = true` (D7).
- Otherwise — permanent `AuthApiError`, or no stored session — stay signed out.

`onAuthStateChange` remains the sole writer afterwards, but **only a session-bearing
event or `SIGNED_OUT` may write `currentUser`**. A later successful refresh overwrites
the adopted user and clears `sessionUnverified`; `SIGNED_OUT` clears both, and D1's
false branch evicts auth-only views. Every *other* null session is ignored.

That last rule is load-bearing, not defensive: `onAuthStateChange` replays
`INITIAL_SESSION` to each new subscriber by re-running the session load
(`_emitInitialSession`, `GoTrueClient.js:3378`). Offline that repeats the refresh which
already failed, and its `catch` delivers `INITIAL_SESSION(null)` — undoing the adoption
made moments earlier and bouncing the user to the sign-in form. `_removeSession()` is
the only emitter of `SIGNED_OUT` (`:3981`) and runs only on an explicit sign-out or a
**permanent** refresh failure, so it is the one null that carries information.

- *Why include the online-but-auth-unreachable case, not just `!navigator.onLine`?*
  The reported symptom is mostly the **slow** case (free-tier auth cold start), not the
  offline one. Restricting adoption to offline leaves the PWA bug half-fixed.
- *Is booting on an unrefreshed token safe?* It grants no server access — a stale JWT
  401s at PostgREST. It grants the *client* identity (`user.id`) needed to key the
  offline caches and satisfy `requiresAuth`. The residual risk is the online-retryable
  window, where `isOnline` is true so `mutate` takes the online branch and a write can
  fail instead of queueing. That window is bounded by auth-js's retry, and the same
  exposure already exists whenever a token expires mid-session — this change doesn't
  create it. The alternative (sign-in form) trips the OTP rate limit, which is worse.
- *Why not `getUser()` as the check?* It is a network call — the thing that is failing.
- *Why not treat every `getSession()` error as retryable?* A revoked refresh token must
  sign the user out. Adopting it strands the user in an authenticated-looking shell
  whose every request 401s, with no path back to the sign-in form.
- *A **500** from the auth server signs the user out; 502/503/504 do not.* auth-js maps
  only `NETWORK_ERROR_CODES = [502, 503, 504]` to `AuthRetryableFetchError`
  (`lib/fetch.js:6`) despite the adjacent comment claiming the whole 5xx range — a bare
  500 becomes a permanent `AuthApiError`. Worse, `_recoverAndRefresh` then calls
  `_removeSession()` (`GoTrueClient.js:3822`), so auth-js **deletes the stored session**
  and there is nothing left to adopt on the next boot. Accepted, not worked around:
  hosted Supabase fronts GoTrue with a gateway that returns 502/503/504 when it is
  unhealthy, so the realistic outage shape is already retryable, and a 500 from a
  *responding* auth server is a genuine fault rather than a connectivity problem.
  Adopting past it would mean fighting the library for a session it has already erased.
- *Why no staleness cap (e.g. refuse sessions older than 30 days)?* The server owns
  refresh-token lifetime; a hardcoded window is a guess that drifts with project JWT
  settings, and guessing short signs out users who would have refreshed fine. The user
  it would "protect" is offline and cannot sign in anyway — a dead-end form is strictly
  worse than stale data plus the D7 notice. On reconnect auth-js resolves it for real.

### D3 — Find the persisted session's storage key; never write it

`SupabaseClient.storageKey` is `protected` (`dist/index.d.mts:282`) and auth-js derives
the default as `` `sb-${new URL(url).hostname.split('.')[0]}-auth-token` ``
(`dist/index.mjs:373`). We locate the entry read-only, by pattern, and do **not** pass
`storageKey` to `createClient`:

```ts
const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
```

Parse in `try/catch`; use the value only when it has `user.id` and `refresh_token`.
When `getSession()` failed retryably and no entry matched, log a **warning** via
`useLogger` — that is the tripwire for the pattern going stale.

- *Why not pin `storageKey` in `createClient`?* Same upside, worse downside: if the
  pinned value differs by one character from the current default, the client starts
  writing a new key and **every existing user is signed out on deploy**. Read-only
  lookup fails closed — worst case is "no adoption", i.e. today's behaviour, and only
  path B regresses (path A is fixed by D1 alone and never touches storage).
- *Why pattern-match instead of re-deriving the hostname formula?* No coupling to
  auth-js's derivation, and one expression covers both `127.0.0.1:54321` (`sb-127-…`)
  and `*.supabase.co`. Single `createClient` in the app (`core/utils/supabase.ts:5`), so
  no ambiguity about which key matches.
- *Why not a custom `storage` adapter mirroring the session into a module variable?*
  It is only written *after* auth-js loads a session — never on the failing path.

### D4 — No "restoring session" splash

Under D2 the flash largely evaporates: a merely slow `getSession()` is awaited before
mount, and a failed one now adopts before mount, so auth is settled by the first
navigation in both cases. A splash would add i18n keys and a visual state to keep in
sync for a case that no longer occurs. If a flash shows up in practice, a
`redirectIfAuth`-only skeleton is a separate cosmetic change.

### D5 — Delete `verify-otp-page.vue`'s local watcher

`verify-otp-page.vue:19-25` runs the same mechanism D1 installs at the root — auth true
→ `push({ name: 'map' })`, gated on `!profileStore.isLoading`. It exists because someone
hit this problem on one page and fixed it there; `home-page.vue` never got the same
treatment, which *is* this bug. Keeping both means two competing mechanisms for one
behaviour plus a swallowed `NavigationDuplicated` failure on the main sign-in path. Its
two assertions (`verify-otp-page.test.ts:59,67`) move to the `setupAuthRedirect` test —
coverage moves with the behaviour rather than dropping.

Difference accepted: the page gates reactively on `profileStore.isLoading`, D1 gates by
awaiting `loadProfile()`. These diverge only if another caller has a profile load in
flight — impossible on a route reachable only while signed out.

### D6 — Offline with no cached profile means *unknown*, not *incomplete*

`cachedLoad` paints the cache and returns when offline (`core/offline/cached-load.ts:48-58`)
— no fetch. On a cache miss `profile` stays `null`, and the guard
(`app/router/index.ts:80-86`) reads that as incomplete and redirects to `/onboarding`,
where the user retypes their name, `updateProfile` queues, and the replay **overwrites
the server profile** under LWW. That path is unreachable today (an offline cold start is
signed out); D2 creates it.

The guard therefore skips the completeness check when
`(!isOnline || sessionUnverified) && profile === null` — the unverified case for the same
reason, since D11 skips reads there too, so a `null` profile is equally "not loaded".
Routing on a fact we could not load is the actual defect. Accepted cost: a genuinely
un-onboarded user opening offline reaches `/map`, self-correcting on the next online
launch. This is the one guard rule that changes.

### D7 — Surface the unverified session instead of capping its age

`sessionUnverified` is a **module-level `ref`** in `core/auth/session-trust.ts` — the
same shape as `isOnline` (`core/offline/use-online-status.ts`), and for the same reason:
`core/offline/mutate.ts` must read it (D9) and `core/` may not import a feature store.
The auth store is its only writer: set on adoption (D2), cleared by `onAuthStateChange`
the moment any event delivers a real session.

`offline-indicator.vue` already owns the global offline surface — the persistent icon
plus a 4-second explanatory snackbar on each drop (`core/components/offline-indicator.vue:14-27`).
When `sessionUnverified` is true that snackbar shows `offline.unverifiedSession` instead
of `offline.indicator`. One new key in `en.json` **and** `de-CH.json`, no new component,
no new visual state.

### D9 — An unverified session queues writes rather than attempting them

`mutate` branches on `isOnline` alone (`core/offline/mutate.ts:95-96`): online → run
`spec.run()` and let failures throw to the store's error state; offline → enqueue.
In the online-but-auth-unreachable window that is wrong — the JWT is stale, PostgREST
401s, and the user's edit dies in an error toast instead of landing in the durable
outbox. Offline the user is protected; here they are not, which is the one path where
D2's adoption can cost someone work.

So the online branch requires **both** signals: `isOnline.value && !sessionUnverified.value`.
Everything else about the offline path — optimistic apply, cache write-through in one
transaction (DC2), coalescing, `savedOfflineAt` — is reused untouched.

- *Why not force `isOnline` false while unverified?* It would fix writes and reads in
  one line, but the offline indicator would then claim there is no connectivity when
  there is. The signal means "can we reach the network"; overloading it with "do we
  trust our token" makes both meanings unreliable.
- *Reads follow, for a different reason (D11).* The original plan left reads alone,
  reasoning that a stale JWT merely 401s and `cachedLoad` keeps the painted snapshot.
  That reasoning was wrong about the failure mode — see D11.
- *Why not a shared "can we write" predicate?* Two call sites (`mutate`, the D8 drain
  guard) with genuinely different checks — the drain wants a *live session object* to
  force a refresh, `mutate` wants the trust flag. One abstraction over two different
  questions.

### D8 — The drain waits for a real token, and fires the moment one arrives

On reconnect from an adopted session, `isOnline` flips true while the refresh is still
in flight. `flush-triggers.ts:23` then drains with a stale JWT: every write 401s,
`bumpAttempt` burns the budget, and entries dead-letter as `transient` — surviving, but
demoted to a manual retry surface. Two small changes:

1. **Guard** in `replayQueue()`: `await supabase.auth.getSession()`; bail out if there
   is no session. One check covers all three trigger paths (`isOnline` watch,
   `visibilitychange`, realtime `SUBSCRIBED` → `reconnect.ts:12`), and `replayQueue()`
   is already single-flight so the cost is one storage/refresh call per drain.
2. **Trigger** on auth: drain on `SIGNED_IN` / `TOKEN_REFRESHED`, so the queue flushes
   the instant the session becomes real — including after a fresh sign-in when the
   adopted session was ultimately rejected. The outbox is durable and is never cleared
   on sign-out, so writes queued offline survive to that point.

Not addressed here: queue entries carry no `userId`, so on a shared device the previous
user's entries drain under the next session (RLS should reject them into `permanent`
dead-letters, unverified across all handlers). Tracked as **issue #276**.

### D10 — The session check is bounded; the app never waits on it

`bootstrap()` awaits `authStore.initialize()` before `app.use(router)` and `app.mount()`,
so nothing renders until the session settles. That is fine when the answer is local and
fatal when it isn't: `_refreshAccessToken` wraps the token POST in `retryable()` with
exponential backoff and keeps going until the next backoff would overflow
`AUTO_REFRESH_TICK_DURATION_MS` — a full **30 seconds** (`GoTrueClient.js`). An offline
cold start with an expired access token therefore showed a blank screen for 30s.

`initialize()` races `getSession()` against `SESSION_RESTORE_TIMEOUT_MS = 4000` and, on
timeout, takes the same branch as an unreachable refresh (D2). The race discards nothing:
whatever the retries eventually decide still arrives via `onAuthStateChange` — success as
`TOKEN_REFRESHED` (upgrading to verified and triggering a drain, D8), permanent failure
as `SIGNED_OUT`.

- *Why 4s and not tighter?* A session wrongly marked unverified refuses the online-only
  actions — attachment upload/delete, `deletePhone`, friend-request `accept` — with an
  "unavailable offline" notice while the device is online. Supabase's free tier is slow
  enough that a 1–2s cap would hit that on ordinary cold starts. This should fire on
  genuine failure, not on slowness; a blank moment is cheaper than a lie.
- *Why not a splash instead?* D4. A cap plus optimistic mount needs no new UI.

### D11 — An unverified session skips reads too, and refetches when it clears

D9's original reasoning — a read on a stale JWT just 401s — was wrong about *how* it
fails. Every supabase-js request resolves its access token through `auth.getSession()`
first, so a fetch during the unverified window does not fail fast: it queues behind the
same 30s refresh-retry loop and **hangs**. With `bootstrap()` awaiting
`profileStore.loadProfile()`, that reintroduced the D10 blank screen one layer down, and
it would have stalled the first load of every other store identically.

So `cachedLoad` gates its fetcher on `isOnline && !sessionUnverified` — the same predicate
`mutate` uses for writes. Reads and writes now agree on what "reachable" means, in the two
shared seams rather than at any call site.

Skipping reads leaves the store on a cached snapshot with nothing scheduled to replace it:
the realtime channel never dropped, so no re-SUBSCRIBE fires. `use-realtime-subscription`
therefore watches `sessionUnverified` and calls the consumer's existing `onSubscribed` on
the true→false edge, guarded to that direction and to consumers holding a channel (a
hidden tab refetches on resubscribe anyway).

- *Why that seam?* Every store already declares its refetch there — mostly
  `flushThenRefetch(loadX)` — so one change reaches all seven subscribers and the DC4
  drain-before-refetch ordering is preserved for free. A parallel registry would
  duplicate that wiring and could drift from it.
- *Why not rely on realtime reconnecting?* Only true when the socket actually dropped.
  Unverified-but-online leaves it up, so recovery by convention silently doesn't happen.

### D12 — Sign-out must succeed without the network

auth-js cannot deliver this: `_signOut` loads the session first (offline, that repeats the
failed refresh and errors out), and otherwise POSTs `/logout` and bails on any error that
isn't 401/403/404. Both paths return **before** `_removeSession()`, leaving the session on
disk — which D2 would then adopt on the next cold start, signing the user back in. The
throw also stranded `handleSignOut` (`user-profile-sheet.vue:231`, no `try`/`catch`), so
the sheet never closed.

`signOut()` does a best-effort revoke, removes the persisted key itself, clears
`currentUser` and `sessionUnverified`, and never throws. A sign-out reporting failure
after destroying local state is worse than one leaving a server session to expire.

## Risks / Trade-offs

- **A stale-but-cached view during the unverified window.** Reads are skipped (D11), so
  the user sees the last cached snapshot until a real token arrives. Bounded by the
  refresh; recovery is explicit rather than conventional.
- **A slow cold start (>4s) mounts as unverified** (D10) and refuses online-only actions
  for that window. Self-heals on `TOKEN_REFRESHED`.
- **A bare 500 from the auth server signs the user out** and auth-js erases the stored
  session, so the next boot cannot adopt (D2). Accepted; gateways emit 502/503/504.
- **Storage-key pattern goes stale.** Fails closed to "no adoption" and logs a warning
  (D3); path A stays fixed regardless.
- **Double navigation.** If a navigation is in flight when the watcher fires, the push
  may abort. Harmless — the guard resolves the same destination — and the
  `meta.redirectIfAuth` gate keeps it rare.
- **Un-onboarded user reaches `/map` offline** (D6). Self-corrects online.
- **One extra `getSession()` per drain** (D8). Storage read in the common case.

## Migration Plan

Ship in one PR. No data migration, no Worker deploy, no schema change. Rollback is a
revert; nothing persists a new shape. Issue #276 ships separately.

## Open Questions

None — settled in review. Follow-ups: user-scoped write queue (#276), and a
`redirectIfAuth` skeleton only if a flash is observed in practice (D4).
