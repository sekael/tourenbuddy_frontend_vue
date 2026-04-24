## ADDED Requirements

### Requirement: Magic link callback page completes session

The app SHALL display a callback page at `/auth/callback` that completes the Supabase PKCE exchange triggered by clicking the magic link in the email and routes the user to the appropriate post-login destination.

#### Scenario: Successful magic link click

- **WHEN** an unauthenticated user opens `/auth/callback?code=…` after clicking a valid magic link
- **THEN** the Supabase JS client SHALL exchange the code automatically (via `detectSessionInUrl`), `onAuthStateChange` SHALL fire `SIGNED_IN`, and the page SHALL redirect to `/map` (or `/onboarding` if the profile is incomplete)

#### Scenario: Expired or invalid token

- **WHEN** the URL contains `?error=access_denied` or `?error_description=…`
- **THEN** the page SHALL display the localized error message and a button that returns the user to `/auth/email`

#### Scenario: Loading state while exchanging

- **WHEN** the callback page mounts and no auth state has resolved yet
- **THEN** the page SHALL show a localized loading indicator and SHALL NOT redirect until either `SIGNED_IN` fires or an error is surfaced

### Requirement: Locale captured in user metadata at sign-up

When the auth store calls `signInWithOtp` and the user does not yet exist, the request SHALL include `options.data.locale` set to the base language code (`en` or `de`) derived from the active i18n locale.

#### Scenario: New user with German locale

- **WHEN** a new user with active i18n locale `de-CH` requests a magic link
- **THEN** the call SHALL pass `options.data.locale = 'de'` so Supabase persists it on user creation in `user_metadata`

#### Scenario: New user with English locale

- **WHEN** a new user with active i18n locale `en` requests a magic link
- **THEN** the call SHALL pass `options.data.locale = 'en'`

## MODIFIED Requirements

### Requirement: Email entry page collects user email

The app SHALL display an email entry page at `/auth/email` where users enter their email address to receive a magic link.

#### Scenario: Valid email submission

- **WHEN** a user enters a valid email address and submits the form
- **THEN** the app SHALL call Supabase `signInWithOtp({ email, options: { emailRedirectTo: '<origin>/auth/callback', data: { locale } } })` and navigate to the check-email page

#### Scenario: Invalid email submission

- **WHEN** a user enters an invalid email address and submits the form
- **THEN** the app SHALL display a validation error and NOT call Supabase

### Requirement: Auth store manages session state

A Pinia store (`useAuthStore`) SHALL manage the current user session, exposing reactive state for `isAuthenticated`, `currentUser`, and `isLoading`, and a `sendMagicLink(email)` action that issues the Supabase magic link request.

#### Scenario: Store initialization

- **WHEN** the app starts
- **THEN** the auth store SHALL check for an existing Supabase session and set `isAuthenticated` accordingly

#### Scenario: Sign out

- **WHEN** `signOut()` is called on the auth store
- **THEN** the store SHALL call Supabase `signOut()`, clear the session, and the router guard SHALL redirect to `/`

#### Scenario: sendMagicLink for new user

- **WHEN** `sendMagicLink('user@example.com')` is called and the user does not yet exist
- **THEN** the store SHALL call `signInWithOtp` with `emailRedirectTo` pointing to the callback route and `options.data.locale` set to the active base locale

#### Scenario: sendMagicLink for existing user

- **WHEN** `sendMagicLink('user@example.com')` is called and the user already exists
- **THEN** the store SHALL call `signInWithOtp` with `emailRedirectTo` and the request SHALL succeed without overwriting existing `user_metadata.locale` (Supabase merges `data` only at user creation)

### Requirement: Auth gate redirects based on session state

The Vue Router SHALL use a `beforeEach` navigation guard that checks the user's authentication state and redirects accordingly. The callback route SHALL be exempt from `redirectIfAuth` so it can complete the PKCE exchange while the user is still unauthenticated.

#### Scenario: Unauthenticated user visits protected route

- **WHEN** an unauthenticated user navigates to `/map`
- **THEN** the router SHALL redirect to `/` (home page)

#### Scenario: Authenticated user visits auth pages

- **WHEN** an authenticated user navigates to `/` or `/auth/email` or `/auth/check-email`
- **THEN** the router SHALL redirect to `/map`

#### Scenario: Callback route always reachable

- **WHEN** any user (authenticated or not) navigates to `/auth/callback`
- **THEN** the router SHALL allow the navigation so the callback page can run its exchange/error logic

#### Scenario: Auth state changes after magic link click

- **WHEN** a user clicks the magic link and the callback page completes the exchange
- **THEN** the Supabase `onAuthStateChange` listener SHALL update the auth store and the callback page SHALL navigate to `/map` or `/onboarding`

## REMOVED Requirements

### Requirement: OTP verification page verifies the code

**Reason**: Replaced by magic link flow. Users no longer enter a code; they click a link that lands on `/auth/callback`.

**Migration**: Delete `src/features/auth/presentation/pages/verify-otp-page.vue` and its route. Replace with `check-email-page.vue` (instructional only) at `/auth/check-email` plus `callback-page.vue` at `/auth/callback`. Any user holding an unredeemed OTP must request a new magic link.

### Requirement: OTP verification page layout

**Reason**: The OTP verification page is removed (see above). The replacement check-email page does not require an OTP input.

**Migration**: Build `check-email-page.vue` with title, instructional subtitle naming the recipient, a resend button, and a back button — no input field, no verify button.
