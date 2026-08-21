## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/auth-session-restore-redirect`

## 2. Session restore survives a retryable refresh failure

- [x] 2.1 `auth-store.ts` — add a module-private `readPersistedSession()`: find the key
  with `Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))`,
  `JSON.parse` inside `try/catch`, return the `user` only when `user?.id` AND
  `refresh_token` are present, else `null` (design D3). Do NOT pass `storageKey` to
  `createClient` — the lookup must stay read-only so a stale pattern fails closed
- [x] 2.2 `initialize()` — capture `error` from `getSession()`; when there is no session
  AND (`error?.name === 'AuthRetryableFetchError'` OR `navigator.onLine === false`), set
  `currentUser` from `readPersistedSession()` and set `sessionUnverified = true`
  (design D2). Permanent errors and a missing/malformed entry stay signed out, no throw.
  No staleness cutoff on the adopted session
- [x] 2.3 When adoption was attempted but no persisted entry matched, `logger.warn(...)` —
  this is the tripwire for the key pattern going stale (design D3)
- [x] 2.4 New `src/core/auth/session-trust.ts` — module-level `export const sessionUnverified = ref(false)`,
  modelled on `core/offline/use-online-status.ts` (side-effect-free import, no store
  dependency, design D7). The auth store is its ONLY writer
- [x] 2.5 Set it on adoption (2.2); clear it in `onAuthStateChange` on any event carrying a
  session, and verify `SIGNED_OUT` clears both it and `currentUser` (the handler already
  assigns `session?.user ?? null` — extend, do not duplicate)

## 3. One reactive auth→navigation seam

- [x] 3.1 `src/app/router/index.ts` — add `setupAuthRedirect(authStore, profileStore, notificationsStore, router)`
  holding the **whole** watcher moved out of `main.ts:60-77`, both branches. Take
  structural param types the way `setupRouterGuards` does, not Pinia store types (design D1)
- [x] 3.2 True branch order is load-bearing: `await profileStore.loadProfile()` →
  `notificationsStore.ensurePushSubscription()` → push `{ name: 'map' }` **only** when
  `router.currentRoute.value.meta.redirectIfAuth`. False branch keeps today's behaviour
  verbatim (clear stores, push `home` when the current route `requiresAuth`)
- [x] 3.3 `src/main.ts` — replace the inline watcher with the `setupAuthRedirect(...)` call
- [x] 3.4 Delete the local `isAuthenticated` watcher in `verify-otp-page.vue:19-25`
  (design D5); confirm the OTP verify path still lands on `/map` in manual testing (8.5)

## 4. Offline profile-completeness gate

- [x] 4.1 `src/app/router/index.ts` — in the `requiresCompleteProfile` branch, skip the
  check when `!isOnline.value && profile === null` (design D6). Import `isOnline` from
  `core/offline/use-online-status`; leave `requiresAuth` / `redirectIfAuth` untouched

## 5. Queue drains only under a real session

- [x] 5.1 `src/core/offline/replay.ts` — at the top of `replayQueue()`, bail out when
  `(await supabase.auth.getSession()).data.session` is null: return without touching any
  entry, so no `bumpAttempt` and no dead-lettering (design D8). Preserve single-flight
- [x] 5.2 `src/core/offline/flush-triggers.ts` — add a `SIGNED_IN` / `TOKEN_REFRESHED`
  trigger calling `void replayQueue()`, alongside the existing `isOnline` watch and
  `visibilitychange` listener. Keep the register-once guard
- [x] 5.3 `src/core/offline/mutate.ts:95` — the online branch requires
  `isOnline.value && !sessionUnverified.value`; otherwise enqueue (design D9). Do not
  touch the offline branch, the optimistic apply, or the cache write-through
- [x] 5.4 Confirm the drain guard's `getSession()` is what forces the refresh on reconnect
  (auth-js's own auto-refresh ticker is ~30s and has no network listener) — if the guard
  is moved or memoized, that property is lost

## 6. Unverified-session notice

- [x] 6.1 `src/locales/en.json` AND `src/locales/de-CH.json` — add `offline.unverifiedSession`
  ("Signed in offline — your data may be out of date" / de-CH equivalent). Files stay
  key-for-key identical; add no other key
- [x] 6.2 `src/core/components/offline-indicator.vue` — the explanatory snackbar renders
  `offline.unverifiedSession` when the `sessionUnverified` ref is true, otherwise
  `offline.indicator` (design D7). No new component, no new visual state

## 7. Tests (edge cases + failures only)

- [x] 7.1 `test/features/auth/presentation/stores/auth-store.test.ts` — mock
  `supabase.auth.getSession`: (a) `{ session: null, error: { name: 'AuthRetryableFetchError' } }`
  + a valid `sb-<ref>-auth-token` entry in `localStorage` ⇒ authenticated with the persisted
  user id AND `sessionUnverified` true; (b) same but a permanent `AuthApiError` ⇒ signed
  out; (c) retryable + malformed JSON ⇒ signed out, no throw; (d) retryable + entry
  missing `refresh_token` ⇒ signed out; (e) `SIGNED_OUT` after adoption ⇒ both cleared
- [x] 7.2 `test/app/router/router-guards.test.ts` — `setupAuthRedirect`: auth flips true on
  a `redirectIfAuth` route ⇒ pushes `{ name: 'map' }` after the profile load resolves;
  auth flips true on a route without `redirectIfAuth` ⇒ no push. Absorb the two migrated
  assertions from `verify-otp-page.test.ts:59,67`
- [x] 7.3 Same file — guard case for D6: offline + `profile === null` + `requiresCompleteProfile`
  ⇒ no redirect to `onboarding`; online + `profile === null` ⇒ still redirects
- [x] 7.4 `test/core/offline/replay.test.ts` — no session ⇒ `replayQueue()` returns without
  incrementing attempts or dead-lettering any entry
- [x] 7.5 `test/core/offline/mutate.test.ts` — `isOnline` true + `sessionUnverified` true ⇒
  the write is enqueued and `spec.run` is NOT called
- [x] 7.6 `test/features/auth/presentation/pages/verify-otp-page.test.ts` — drop the two
  watcher assertions that moved in 7.2; the rest of the file is unchanged
- [x] 7.7 `npm run test` — all pass

## 8. Manual verification

- [ ] 8.1 Reproduce the bug first on `main` (DevTools → Network → Slow 3G, expire the
  stored `expires_at`, reload) so the fix is measured against a seen failure
- [ ] 8.2 Installed PWA, signed in: close and reopen several times in quick succession ⇒
  `/map` every time, no email form, no OTP rate-limit error
- [ ] 8.3 Browser, throttled network: reload on `/` with an expired access token ⇒ ends on
  `/map` without input
- [ ] 8.4 Offline cold start with a persisted session ⇒ `/map` renders from the offline
  cache, the offline snackbar shows the unverified-session copy, no sign-in form. Check
  the console for the 2.3 warning — if it fired, the key lookup missed
- [ ] 8.5 Signed out (clear the auth storage key) ⇒ `/` shows the email form and the OTP
  flow works end to end, landing on `/map` (no #260 regression, D5 removal verified)
- [ ] 8.6 Queue a write offline on an expired session, then restore connectivity ⇒ the
  write replays once the token refreshes, WITHOUT any sign-in step, no `transient`
  dead-letter, pending count returns to zero
- [ ] 8.7 Edit something in the unverified-but-online window (throttle auth to fail while
  the browser reports online) ⇒ the edit is queued and shows as pending, NOT an error
- [ ] 8.8 Prod parity check: Dashboard → Authentication → Sessions has no timebox and no
  inactivity timeout (local `config.toml:305-309` has both commented out). If prod sets
  one, long-dormant adopted sessions WILL require a fresh sign-in and design D2's
  no-cap decision needs revisiting
- [ ] 8.9 Sign out from the profile sheet ⇒ lands on `/`, and reopening the app does NOT
  restore the session
- [ ] 8.10 Both locales: `offline.unverifiedSession` renders correctly in `en` and `de-CH`

## 9. Finalize

- [x] 9.1 `npx eslint . --fix` — zero warnings
- [x] 9.2 `npm run type-check` — clean
- [ ] 9.3 Prompt user to commit (do NOT commit) with message: `fix(auth): restore session on cold start and redirect off sign-in`
- [ ] 9.4 Prompt user to push the branch and open a PR to `main`, referencing issue #276 as
  the tracked follow-up (out of scope here)
