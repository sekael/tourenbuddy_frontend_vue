## Why

Since `auth-landing-direct-signin` (#260) removed the "Get Started" screen, an already
authenticated user who reopens the app — installed PWA or browser tab — is regularly
left staring at the sign-in form, has to type their email, and only reaches `/map` as a
side effect of pressing **Send code**. Opening the app a few times in a row then trips
Supabase's OTP rate limit ("For security purposes, you can only request this after N
seconds") on a session that was valid the whole time.

The CTA button was masking a boot-order bug. Session restore is not always finished
when the first navigation happens:

`authStore.initialize()` awaits `supabase.auth.getSession()`. When the stored access
token is within the expiry margin, `getSession()` performs a **network** token refresh
(`GoTrueClient.__loadSession` → `_callRefreshToken`). On a slow free-tier auth endpoint
— or with no network at all — that call fails, `getSession()` resolves `session: null`,
and the app boots as unauthenticated. The persisted refresh token is *not* discarded:
auth-js retries in the background and eventually emits `TOKEN_REFRESHED` / `SIGNED_IN`,
so the store *does* become authenticated a moment later.

Nothing acts on that late transition. The router guard (`redirectIfAuth`) only runs on
navigation, and `main.ts` watches `isAuthenticated` **only for the false branch**. So
the user sits on `/` with a live session. The old "Get Started" button happened to
trigger a navigation, which re-ran the guard — that is the entire reason the bug was
invisible before #260. Pressing "Send code" today does the same thing, which is why it
"works", at the cost of a pointless OTP.

The same failure mode also breaks the offline-first promise: an installed PWA opened
with no connectivity and an expired access token can never restore its session, so an
offline-capable app dead-ends on a sign-in form it cannot complete offline.

## What Changes

- **Late session restore navigates.** The `isAuthenticated` watcher moves out of
  `main.ts` — whole, both branches — into a tested `setupAuthRedirect()` beside
  `setupRouterGuards` in `app/router/index.ts`, and gains its true branch: when auth
  flips true while the current route is a `redirectIfAuth` route, navigate to `/map`
  after the profile load resolves, so the `requiresCompleteProfile` guard sees real data
  instead of bouncing a complete profile to `/onboarding`.
- **Offline / unreachable-auth cold start keeps the session.** `authStore.initialize()`
  stops treating a *network* failure of the refresh as "signed out". When
  `getSession()` returns no session but the persisted session is still in storage and
  the failure is retryable (offline, fetch error, timeout), the store adopts the stored
  user so the app boots authenticated and hydrates from the offline cache. A
  **permanent** auth error (invalid / revoked refresh token) still signs the user out.
  No cap on how old the adopted session may be — the server owns refresh-token lifetime.
- **The reduced trust is visible, and writes respect it.** A module-level
  `sessionUnverified` signal (same shape as `isOnline`) is set while running on an
  adopted session. The existing offline snackbar says "signed in offline — data may be
  out of date" instead of its usual line (one new i18n key per locale, no new component),
  and `mutate` takes the **offline branch** while it is set — so an edit made before the
  token is refreshed is queued durably instead of dying in an error state.
- **Queued writes replay when — and only when — the session is real.** `replayQueue()`
  bails out unless a session exists, so a drain triggered by `isOnline` mid-refresh
  can't burn the attempt budget into `transient` dead-letters; a new `SIGNED_IN` /
  `TOKEN_REFRESHED` trigger drains the outbox the instant a token lands, including after
  a fresh sign-in.
- **`verify-otp-page.vue`'s local redirect watcher is deleted** — it is the same
  mechanism, per-page, and its tests move to `setupAuthRedirect`.
- **Offline with no cached profile no longer means "incomplete".** The guard skips the
  completeness check when `!isOnline && profile === null`, instead of routing a user to
  `/onboarding` on data it could not load (and queueing a profile overwrite behind it).
- **No change to the sign-in UI, the OTP flow, or the guard's auth rules.** `/` still
  shows the email form for a genuinely signed-out user; `requiresAuth` and
  `redirectIfAuth` are untouched.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth`: session restore survives a network-failed token refresh (offline cold start
  included), and an authenticated session that lands after the first navigation
  redirects off the sign-in screen instead of stranding the user there.

## Impact

- **`src/app/router/index.ts`:** gains `setupAuthRedirect()` (the relocated watcher).
  The `beforeEach` guard's only rule change is the D6 completeness skip; `requiresAuth`
  and `redirectIfAuth` behave exactly as today.
- **`src/main.ts`:** the inline watcher is replaced by a `setupAuthRedirect(...)` call.
- **`src/features/auth/presentation/stores/auth-store.ts`:** `initialize()` gains the
  stored-session fallback for retryable refresh failures plus the `sessionUnverified`
  flag; `onAuthStateChange` remains the single writer afterwards and must clear both on
  `SIGNED_OUT`.
- **`src/features/auth/presentation/pages/verify-otp-page.vue`:** local `isAuthenticated`
  watcher deleted.
- **`src/core/auth/session-trust.ts` (new):** module-level `sessionUnverified` ref, the
  `isOnline` pattern. Written only by the auth store; read by `mutate` and the offline
  indicator (`core/` must not import a feature store).
- **Offline (`core/offline/`):** `replay.ts` gains the session guard, `flush-triggers.ts`
  gains the auth-event trigger, `mutate.ts:95` requires `isOnline && !sessionUnverified`
  for the online branch. The outbox, coalescing and cache write-through are untouched.
  Residual exposure: **reads** in that window still 401 — `cachedLoad` keeps the painted
  cache and records the error, so the user sees stale data rather than a blank screen.
- **`src/core/components/offline-indicator.vue`:** snackbar copy switches on
  `sessionUnverified`.
- **Locales:** one new key (`offline.unverifiedSession`) in `en.json` AND `de-CH.json` —
  the files stay key-for-key identical.
- **Tests:** auth-store cases (retryable failure adopts; permanent error does not;
  malformed / incomplete storage entry stays signed out; `SIGNED_OUT` clears), a
  `setupAuthRedirect` test for the late transition and the no-push-elsewhere case
  (absorbing the two migrated `verify-otp-page` assertions), a guard case for D6, and a
  `replayQueue` case for the no-session bail-out. No happy-path assertions.
- **Not in scope:** the write queue is not user-scoped, so on a shared device a previous
  user's entries drain under the next session — pre-existing, tracked as **issue #276**.
- **No DB migration, no Worker deploy, no new dependency.**
