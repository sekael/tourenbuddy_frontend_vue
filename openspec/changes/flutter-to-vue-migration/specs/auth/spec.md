## ADDED Requirements

### Requirement: Email entry page collects user email

The app SHALL display an email entry page at `/auth/email` where users enter their email address to receive a one-time password.

#### Scenario: Valid email submission

- **WHEN** a user enters a valid email address and submits the form
- **THEN** the app SHALL call Supabase `signInWithOtp({ email })` and navigate to the OTP verification page

#### Scenario: Invalid email submission

- **WHEN** a user enters an invalid email address and submits the form
- **THEN** the app SHALL display a validation error and NOT call Supabase

### Requirement: OTP verification page verifies the code

The app SHALL display an OTP verification page at `/auth/verify-otp` where users enter the 8-character code received via email.

#### Scenario: Valid OTP verification

- **WHEN** a user enters a valid 8-character OTP code
- **THEN** the app SHALL call Supabase `verifyOtp({ email, token, type: 'email' })` and on success, redirect to the map page

#### Scenario: Invalid OTP code

- **WHEN** a user enters an incorrect OTP code
- **THEN** the app SHALL display an error message and allow retry

#### Scenario: Resend OTP

- **WHEN** a user clicks "Resend code"
- **THEN** the app SHALL call `signInWithOtp` again with the same email

### Requirement: Auth gate redirects based on session state

The Vue Router SHALL use a `beforeEach` navigation guard that checks the user's authentication state and redirects accordingly.

#### Scenario: Unauthenticated user visits protected route

- **WHEN** an unauthenticated user navigates to `/map`
- **THEN** the router SHALL redirect to `/` (home page)

#### Scenario: Authenticated user visits auth pages

- **WHEN** an authenticated user navigates to `/` or `/auth/*`
- **THEN** the router SHALL redirect to `/map`

#### Scenario: Auth state changes after login

- **WHEN** a user successfully verifies their OTP
- **THEN** the Supabase `onAuthStateChange` listener SHALL update the auth store and trigger navigation to `/map`

### Requirement: Auth store manages session state

A Pinia store (`useAuthStore`) SHALL manage the current user session, exposing reactive state for `isAuthenticated`, `currentUser`, and `isLoading`.

#### Scenario: Store initialization

- **WHEN** the app starts
- **THEN** the auth store SHALL check for an existing Supabase session and set `isAuthenticated` accordingly

#### Scenario: Sign out

- **WHEN** `signOut()` is called on the auth store
- **THEN** the store SHALL call Supabase `signOut()`, clear the session, and the router guard SHALL redirect to `/`

### Requirement: Home page for unauthenticated users

The app SHALL display a home/landing page at `/` with the app name and a button to navigate to the email entry page.

#### Scenario: Navigate to login

- **WHEN** an unauthenticated user clicks the login button on the home page
- **THEN** the app SHALL navigate to `/auth/email`
