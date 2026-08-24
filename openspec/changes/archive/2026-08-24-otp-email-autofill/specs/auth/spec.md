## MODIFIED Requirements

### Requirement: OTP verification page verifies the code

The app SHALL display an OTP verification page at `/auth/verify-otp` where users enter
the 6-digit code received by email and submit it for verification. The page SHALL
normalize the entered value to digits before verifying, SHALL submit automatically once
six digits are present, and SHALL NOT submit the same value twice or overlap two
verification requests.

#### Scenario: Successful OTP submission

- **WHEN** an unauthenticated user enters a valid 6-digit code on `/auth/verify-otp?email=<email>` and submits
- **THEN** the app SHALL call Supabase `verifyOtp({ email, token, type: 'email' })`, the auth store SHALL receive `SIGNED_IN` via `onAuthStateChange`, and the router SHALL navigate to `/map` (or `/onboarding` if the profile is incomplete)

#### Scenario: Invalid or expired code

- **WHEN** Supabase returns an error from `verifyOtp` (wrong code, expired, used)
- **THEN** the page SHALL display a localized error message under the input, clear the input, and remain on `/auth/verify-otp`

#### Scenario: Rejected code is not resubmitted unchanged

- **WHEN** a code has been submitted and rejected, and the field is repopulated with that
  same value without the user editing it
- **THEN** the page SHALL NOT issue a second verification request for that value, and the
  user SHALL still be able to retry it deliberately via the submit button

#### Scenario: Verification requests do not overlap

- **WHEN** the field reaches six digits while a verification request is already in flight
- **THEN** the page SHALL NOT issue a second concurrent request

#### Scenario: Resend code

- **WHEN** the user clicks the resend button on `/auth/verify-otp`
- **THEN** the app SHALL call `sendEmailOtp(email)` and SHALL display a localized confirmation that a new code was sent

#### Scenario: Back to email entry

- **WHEN** the user clicks the back button
- **THEN** the app SHALL navigate to `/` and SHALL NOT call Supabase

### Requirement: OTP verification page layout

The OTP verification page SHALL include a title, a subtitle naming the recipient email, a
single 6-digit numeric input with `inputmode="numeric"` and `autocomplete="one-time-code"`,
a verify button, a resend button, and a back button. The input SHALL remain a single field
rather than one box per digit, and SHALL NOT carry a `name` attribute, so that password
managers do not treat the one-time code as a storable credential.

#### Scenario: Numeric-only input on mobile

- **WHEN** the page mounts on a mobile device
- **THEN** the input SHALL surface a numeric keyboard and SHALL accept the device's one-time-code autofill where supported

#### Scenario: Code arrives with surrounding whitespace or separators

- **WHEN** the field is populated with a value containing spaces, newlines, or other
  non-digit characters — by paste, by drag-drop, by an OS autofill suggestion, or by
  typing
- **THEN** the page SHALL reduce the value to its digits, truncate it to six, and treat the
  result as the code to verify

#### Scenario: Filled code submits without a further action

- **WHEN** the normalized value reaches six digits, no verification is in flight, and that
  value has not already been attempted
- **THEN** the page SHALL start verification without requiring the user to activate the
  submit button

#### Scenario: Incomplete code never submits

- **WHEN** the normalized value holds fewer than six digits
- **THEN** the page SHALL NOT call `verifyOtp`, and the submit button SHALL remain disabled

### Requirement: Email entry page collects user email

The app SHALL collect the user's email address on the landing page at `/`, presented
immediately on arrival with no intermediate call-to-action screen. The form SHALL sit in
the shared hero layout. The email input SHALL carry both `autocomplete="email"` and a
`name` attribute, so that password managers and email-alias providers can classify the
field and offer autofill.

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

#### Scenario: Password manager offers a stored or generated address

- **WHEN** a user focuses the email field with a password manager or OS credential
  provider active
- **THEN** the field is classified as an email field via its `autocomplete` and `name`
  attributes, and a filled value is accepted by the form exactly as a typed one is

#### Scenario: `/auth/email` no longer resolves

- **WHEN** a stale link to `/auth/email` is opened
- **THEN** the route does not exist and the app does not serve an email entry page there
