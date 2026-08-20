## ADDED Requirements

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

### Requirement: OTP verification page verifies the code

The app SHALL display an OTP verification page at `/auth/verify-otp` where users enter
the 6-digit code received by email and submit it for verification.

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

### Requirement: Auth gate redirects based on session state

The Vue Router SHALL use a `beforeEach` navigation guard that checks the user's
authentication state and redirects accordingly.

#### Scenario: Unauthenticated user visits protected route

- **WHEN** an unauthenticated user navigates to `/map`
- **THEN** the router SHALL redirect to `/` (the sign-in page)

#### Scenario: Authenticated user visits auth pages

- **WHEN** an authenticated user navigates to `/` or `/auth/verify-otp`
- **THEN** the router SHALL redirect to `/map`
