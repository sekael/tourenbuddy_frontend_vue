## MODIFIED Requirements

### Requirement: Auth store manages session state

A Pinia store (`useAuthStore`) SHALL manage the current user session, exposing reactive
state for `isAuthenticated`, `currentUser`, and `isLoading`, a `sendEmailOtp(email)`
action that issues the Supabase OTP request, and a `verifyOtp(email, token)` action that
redeems the 6-digit code.

Session restore SHALL distinguish a **retryable** failure of the token refresh (no
network, fetch error, timeout) from a **permanent** authentication failure (invalid,
expired, or revoked refresh token). A retryable failure SHALL NOT sign the user out: the
store SHALL adopt the persisted session's user so the app boots authenticated and serves
its offline caches. A permanent failure SHALL leave the user signed out. Adoption SHALL NOT be limited by the age of the
persisted session — refresh-token lifetime is the server's to enforce.
`onAuthStateChange` SHALL remain the only writer of session state after initialization,
and SHALL write it only for an event that delivers a session or for an explicit sign-out.
Any other event carrying no session SHALL leave the current session untouched.

Session restore SHALL NOT delay the app's first render indefinitely: it SHALL be bounded,
and a restore that does not settle within the bound SHALL be treated as a retryable
failure. The eventual outcome SHALL still be applied when it arrives.

While the app runs on an adopted session the store SHALL expose that the session is
**unverified**, and the app SHALL tell the user their data may be out of date. The flag
SHALL clear as soon as any auth event delivers a verified session.

#### Scenario: Store initialization

- **WHEN** the app starts
- **THEN** the auth store SHALL check for an existing Supabase session and set `isAuthenticated` accordingly

#### Scenario: Token refresh fails because the device is offline

- **WHEN** the app cold-starts with a persisted session whose access token is expired and
  the refresh request fails with a retryable network error
- **THEN** the store SHALL adopt the persisted session's user, `isAuthenticated` SHALL be
  true, and no sign-in screen SHALL be presented

#### Scenario: Refresh token is rejected by the server

- **WHEN** session restore fails with a permanent authentication error (invalid, expired,
  or revoked refresh token)
- **THEN** `isAuthenticated` SHALL remain false and the user SHALL be presented the
  sign-in screen

#### Scenario: Persisted session is absent or unreadable

- **WHEN** no persisted session exists, or the stored value is malformed or lacks a user
  id and refresh token
- **THEN** the store SHALL treat the user as signed out and SHALL NOT throw

#### Scenario: Long-dormant persisted session

- **WHEN** the persisted session's access token expired weeks ago and the refresh fails
  retryably
- **THEN** the store SHALL still adopt it — no client-side staleness cutoff — and the app
  SHALL present the unverified-session notice

#### Scenario: Unverified session is surfaced to the user

- **WHEN** the app is running on an adopted session
- **THEN** the offline surface SHALL state that the user is signed in offline and the
  data shown may be out of date, in the active locale

#### Scenario: Unverified flag clears on a real session

- **WHEN** a token refresh subsequently succeeds
- **THEN** the unverified state SHALL clear and the ordinary offline copy SHALL be
  restored

#### Scenario: Adopted session is later invalidated

- **WHEN** the app is running on an adopted (unrefreshed) session and Supabase emits
  `SIGNED_OUT` once connectivity returns
- **THEN** the store SHALL clear `currentUser` and the app SHALL redirect to `/`

#### Scenario: Session load is replayed to a new listener while the refresh is failing

- **WHEN** the app is running on an adopted session and the auth client re-runs the
  session load for a newly registered listener, which fails the same way and reports no
  session
- **THEN** the adopted session SHALL be retained and the user SHALL NOT be returned to
  the sign-in screen

#### Scenario: Session restore does not settle promptly

- **WHEN** the token refresh neither succeeds nor fails within the restore bound (the
  auth client retries an unreachable refresh with backoff for far longer)
- **THEN** the app SHALL proceed to render on the persisted session rather than waiting,
  and SHALL apply the refresh's eventual result when it arrives

#### Scenario: Sign out

- **WHEN** `signOut()` is called on the auth store
- **THEN** the store SHALL call Supabase `signOut()`, clear the session, and the router guard SHALL redirect to `/`

#### Scenario: Sign out while the auth server is unreachable

- **WHEN** `signOut()` is called with no connectivity
- **THEN** the locally persisted session SHALL be removed and the user signed out
  without an error being raised, so that a subsequent cold start does NOT restore the
  session

#### Scenario: sendEmailOtp for new user

- **WHEN** `sendEmailOtp('user@example.com')` is called and the user does not yet exist
- **THEN** the store SHALL call `signInWithOtp({ email, options: { data: { locale } } })` with `locale` set to the active base locale and SHALL NOT pass `emailRedirectTo`

#### Scenario: sendEmailOtp for existing user

- **WHEN** `sendEmailOtp('user@example.com')` is called and the user already exists
- **THEN** the store SHALL call `signInWithOtp` with the same shape and the request SHALL succeed without overwriting existing `user_metadata.locale`

#### Scenario: verifyOtp success

- **WHEN** `verifyOtp('user@example.com', '123456')` is called with a valid code
- **THEN** the store SHALL call `supabase.auth.verifyOtp({ email, token, type: 'email' })` and `isAuthenticated` SHALL become true via `onAuthStateChange`

#### Scenario: verifyOtp failure

- **WHEN** `verifyOtp` is called with an invalid or expired code
- **THEN** the store SHALL surface the Supabase error to the caller and `isAuthenticated` SHALL remain false

### Requirement: Auth gate redirects based on session state

The Vue Router SHALL use a `beforeEach` navigation guard that checks the user's
authentication state and redirects accordingly. Because that guard only runs on
navigation, the app SHALL additionally observe the authentication state reactively: when
a session becomes available while the user is on a sign-in-only route
(`meta.redirectIfAuth`), the app SHALL navigate to `/map` without user interaction. The
redirect SHALL happen after the user profile has been loaded — from the offline cache
when there is no network — so that the profile-completeness check is not evaluated
against unloaded state. A user standing on any other route SHALL NOT be navigated away
when the session state changes to authenticated.

#### Scenario: Unauthenticated user visits protected route

- **WHEN** an unauthenticated user navigates to `/map`
- **THEN** the router SHALL redirect to `/` (the sign-in page)

#### Scenario: Authenticated user visits auth pages

- **WHEN** an authenticated user navigates to `/` or `/auth/verify-otp`
- **THEN** the router SHALL redirect to `/map`

#### Scenario: Session restore completes after the first navigation

- **WHEN** session restore resolves only after the app has mounted and rendered `/`, and
  `isAuthenticated` becomes true while the user is on that route
- **THEN** the app SHALL navigate to `/map` on its own, with no tap and no OTP request

#### Scenario: Reopening an installed PWA with a valid session

- **WHEN** a user reopens the installed PWA and a valid or restorable session exists
- **THEN** the app SHALL land on `/map`, and the email entry and OTP steps SHALL NOT be
  presented — in particular the app SHALL NOT call `signInWithOtp`, so repeated launches
  SHALL NOT trip the OTP rate limit

#### Scenario: Session lands while the user is on an in-app route

- **WHEN** `isAuthenticated` transitions to true (for example after a token refresh)
  while the user is on a route without `meta.redirectIfAuth`
- **THEN** the app SHALL stay on the current route

#### Scenario: Profile is not yet loaded when the session lands

- **WHEN** the redirect off a sign-in-only route is triggered and the profile has not
  been loaded yet
- **THEN** the app SHALL load the profile (cache-first when offline) before navigating,
  so a user with a complete profile is not sent to `/onboarding`

#### Scenario: Offline with no cached profile

- **WHEN** the app is offline, the profile cache holds no entry, and the user navigates
  to a route requiring a complete profile
- **THEN** the profile-completeness check SHALL be skipped rather than treating the
  unloaded profile as incomplete, so the user is not routed to `/onboarding` and no
  profile overwrite is queued on their behalf

#### Scenario: Unverified session with no cached profile

- **WHEN** the session is unverified, the profile cache holds no entry, and the user
  navigates to a route requiring a complete profile
- **THEN** the profile-completeness check SHALL be skipped for the same reason — the
  profile was never fetched, so it is unknown rather than incomplete

#### Scenario: Entry URL is resolved before the guards exist

- **WHEN** an authenticated user opens the app directly at `/`
- **THEN** the guard SHALL evaluate that navigation and redirect to `/map`, i.e. the
  guards SHALL be registered before the router performs its first navigation
