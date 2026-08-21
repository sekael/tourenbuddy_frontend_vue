## Purpose

Email-based OTP authentication: users sign in by receiving a 6-digit code via email and verifying it, with no passwords stored.

## Requirements

### Requirement: OTP verification page verifies the code

The app SHALL display an OTP verification page at `/auth/verify-otp` where users enter the 6-digit code received by email and submit it for verification.

#### Scenario: Successful OTP submission

- **WHEN** an unauthenticated user enters a valid 6-digit code on `/auth/verify-otp?email=<email>` and submits
- **THEN** the app SHALL call Supabase `verifyOtp({ email, token, type: 'email' })`, the auth store SHALL receive `SIGNED_IN` via `onAuthStateChange`, and the router SHALL navigate to `/map` (or `/onboarding` if the profile is incomplete)

#### Scenario: Invalid or expired code

- **WHEN** Supabase returns an error from `verifyOtp` (wrong code, expired, used)
- **THEN** the page SHALL display a localized error message under the input, clear the input, and remain on `/auth/verify-otp`

#### Scenario: Resend code

- **WHEN** the user clicks the resend button on `/auth/verify-otp`
- **THEN** the app SHALL call `sendEmailOtp(email)` and SHALL display a localized confirmation that a new code was sent

#### Scenario: Back to email entry

- **WHEN** the user clicks the back button
- **THEN** the app SHALL navigate to `/` and SHALL NOT call Supabase

### Requirement: OTP verification page layout

The OTP verification page SHALL include a title, a subtitle naming the recipient email, a single 6-digit numeric input with `inputmode="numeric"` and `autocomplete="one-time-code"`, a verify button, a resend button, and a back button.

#### Scenario: Numeric-only input on mobile

- **WHEN** the page mounts on a mobile device
- **THEN** the input SHALL surface a numeric keyboard and SHALL accept the device's one-time-code autofill where supported

### Requirement: Auth screens share a hero background layout

Every signed-out auth screen SHALL render its content over the same hero background
image with a darkening gradient overlay, presented through a single shared layout
component. The layout SHALL carry the product title as the page's only top-level
heading, SHALL extend the background edge-to-edge including the device safe-area zones,
and SHALL place page content in a translucent card whose input fields keep an opaque
fill. Screen-specific titles inside the card SHALL be third-level headings. Every input
SHALL carry an associated `<label>` element, visually hidden where the design calls for
a placeholder-only field — a placeholder alone SHALL NOT serve as an input's accessible
name.

#### Scenario: Background is continuous across the sign-in flow

- **WHEN** a signed-out user submits their email on `/` and arrives at `/auth/verify-otp`
- **THEN** the same hero background and overlay remain on screen, with no change to a
  flat surface color between the two steps

#### Scenario: Only one top-level heading per auth page

- **WHEN** an auth page renders both the hero product title and its own screen title
- **THEN** the hero title is the only first-level heading and the screen title is a
  third-level heading

#### Scenario: Input legibility over the photographic backdrop

- **WHEN** the sign-in card renders over a light region of the background image
- **THEN** the input fields render on an opaque surface fill, so text contrast never
  depends on the pixels behind the card

#### Scenario: Placeholder-only input is announced by assistive technology

- **WHEN** a screen-reader user focuses the email or the sign-in-code field, which show
  a placeholder and no visible label
- **THEN** the field is announced by its associated visually-hidden `<label>`, and the
  name remains available after the placeholder is replaced by typed input

## MODIFIED Requirements

### Requirement: Email entry page collects user email

The app SHALL collect the user's email address on the landing page at `/`, presented
immediately on arrival with no intermediate call-to-action screen. The form SHALL sit in
the shared hero layout.

#### Scenario: Signed-out user arrives at the app

- **WHEN** an unauthenticated user opens `/`
- **THEN** the email input and submit button are visible without any further navigation,
  and no "Get Started" call-to-action step is presented

#### Scenario: Valid email submission

- **WHEN** a user enters a valid email address and submits the form
- **THEN** the app SHALL call Supabase `signInWithOtp({ email, options: { data: { locale } } })` (no `emailRedirectTo`) and navigate to `/auth/verify-otp?email=<email>`

#### Scenario: Invalid email submission

- **WHEN** a user enters an invalid email address and submits the form
- **THEN** the app SHALL display a validation error and SHALL NOT call Supabase

#### Scenario: OTP dispatch fails

- **WHEN** the Supabase OTP request rejects
- **THEN** the page SHALL display the error, SHALL remain on `/`, and SHALL NOT navigate
  to `/auth/verify-otp`

#### Scenario: `/auth/email` no longer resolves

- **WHEN** a stale link to `/auth/email` is opened
- **THEN** the route does not exist and the app does not serve an email entry page there

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

### Requirement: Locale captured in user metadata at sign-up

When the auth store calls `signInWithOtp` and the user does not yet exist, the request SHALL include `options.data.locale` set to the base language code (`en` or `de`) derived from the active i18n locale.

#### Scenario: New user with German locale

- **WHEN** a new user with active i18n locale `de-CH` requests an OTP
- **THEN** the call SHALL pass `options.data.locale = 'de'` so Supabase persists it on user creation in `user_metadata`

#### Scenario: New user with English locale

- **WHEN** a new user with active i18n locale `en` requests an OTP
- **THEN** the call SHALL pass `options.data.locale = 'en'`

## REMOVED Requirements

### Requirement: Magic link callback page completes session

**Reason**: Magic links break the installed-PWA experience — the link always opens in the system browser, not the standalone PWA window, leaving the user unable to complete sign-in inside the app. Replaced by 6-digit OTP code entry in `/auth/verify-otp`.

**Migration**: Delete `src/features/auth/presentation/pages/callback-page.vue` and the `/auth/callback` route. Remove `https://app.tourenbuddy.ch/auth/callback` from the Supabase Auth → URL Configuration → Redirect URLs allowlist. Anyone holding an unredeemed magic link SHALL request a new code.

### Requirement: Email entry page collects user email (magic-link variant)

**Reason**: The `signInWithOtp` call no longer passes `emailRedirectTo`; see the MODIFIED variant above. This requirement is superseded.

**Migration**: Update `email-entry-page.vue` to call `sendEmailOtp(email)` and navigate to `/auth/verify-otp?email=<email>` instead of `/auth/check-email`. The `check-email-page.vue` file SHALL be deleted.

### Requirement: Home page presents a "Get Started" call to action

**Reason**: Issue #260 — the intermediate landing screen carried no information the sign-in screen did not, costing every signed-out user an extra tap and page load before they could enter their email.

**Migration**: The email form moved onto `/`; `src/features/auth/presentation/pages/email-entry-page.vue` and the `/auth/email` route were deleted, and the `auth.home` i18n block (`subtitle`, `getStartedBtn`) was removed from every locale.
