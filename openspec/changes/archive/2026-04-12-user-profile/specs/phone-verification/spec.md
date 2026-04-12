## ADDED Requirements

### Requirement: Phone number update via Supabase auth

When a user provides a phone number, the system SHALL call `supabase.auth.updateUser({ phone })` to associate the number with the auth user. This triggers Supabase to send an SMS OTP to the provided number.

#### Scenario: Phone number submitted for verification

- **WHEN** a user enters a phone number in the onboarding form or profile edit
- **THEN** `supabase.auth.updateUser({ phone })` SHALL be called with the E.164 formatted number

#### Scenario: SMS send fails

- **WHEN** `updateUser` returns an error (no SMS provider, invalid number, rate limit)
- **THEN** an error message SHALL be displayed to the user and the phone number SHALL NOT be marked as verified

### Requirement: Phone OTP verification flow

After submitting a phone number, a verification code input SHALL be presented. The system SHALL verify the code via `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })`.

#### Scenario: Correct OTP entered

- **WHEN** user enters the correct 6-digit OTP code
- **THEN** `supabase.auth.verifyOtp` SHALL succeed, `phone_confirmed_at` SHALL be set on the auth user, and the UI SHALL show a success state

#### Scenario: Incorrect OTP entered

- **WHEN** user enters an incorrect OTP code
- **THEN** an error message SHALL be displayed and the user SHALL be able to retry

#### Scenario: Resend OTP

- **WHEN** user clicks "Resend code"
- **THEN** `supabase.auth.updateUser({ phone })` SHALL be called again to trigger a new SMS, with a cooldown timer preventing rapid resends

### Requirement: Verified phone badge display

A blue checkmark icon SHALL be displayed next to phone numbers that are verified (`phone_confirmed_at` is not null on the auth user).

#### Scenario: Verified phone shows badge

- **WHEN** the user's phone number is verified (auth user has `phone_confirmed_at` set)
- **THEN** a blue tick/checkmark icon SHALL be displayed next to the phone number in the profile view

#### Scenario: Unverified phone shows no badge

- **WHEN** the user has a phone number but it is not verified
- **THEN** no verification badge SHALL be displayed, and a "Verify" action SHALL be available

#### Scenario: No phone number

- **WHEN** the user has no phone number set
- **THEN** an "Add phone" prompt SHALL be displayed in the profile view

### Requirement: Twilio and Supabase SMS setup

Phone verification requires manual configuration of Twilio (SMS provider) and Supabase Phone Auth provider before the feature can function.

#### Scenario: Twilio account setup

- **WHEN** setting up phone verification for the first time
- **THEN** a Twilio account (free tier) SHALL be created, a phone number with SMS capability obtained, and Account SID + Auth Token noted

#### Scenario: Supabase phone provider configuration

- **WHEN** Twilio credentials are available
- **THEN** Supabase Dashboard → Authentication → Providers → Phone SHALL be enabled with Twilio as SMS provider, configured with Account SID, Auth Token, and Twilio phone number

#### Scenario: SMS provider not configured

- **WHEN** phone verification is attempted but Twilio/Supabase SMS is not configured
- **THEN** the system SHALL display a graceful error message and allow the user to continue without verification
