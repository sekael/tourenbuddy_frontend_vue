## ADDED Requirements

### Requirement: Phone uniqueness pre-check before OTP send

Before invoking `supabase.auth.updateUser({ phone })` to dispatch an OTP, the system SHALL attempt to detect whether the supplied E.164 phone number is already verified by a different user.

For callers whose own `phone_confirmed_at` is set, detection SHALL use the existing `find_user_by_phone` RPC; if it returns a UUID that is non-null and differs from the caller's `auth.uid()`, the system SHALL abort the OTP send and raise a `PhoneAlreadyRegisteredError`.

For callers without a verified phone (RPC returns NULL by design), the system SHALL invoke `supabase.auth.updateUser` and translate any returned error whose message matches the pattern `/already|exists|registered|in use/i` into the same `PhoneAlreadyRegisteredError`. Unmatched errors SHALL be propagated unchanged.

#### Scenario: Conflict detected by pre-check

- **WHEN** the caller is phone-verified and `find_user_by_phone(p_phone)` returns a UUID ≠ `auth.uid()`
- **THEN** `supabase.auth.updateUser` SHALL NOT be called
- **AND** a `PhoneAlreadyRegisteredError` SHALL be thrown

#### Scenario: Number belongs to caller (re-verify)

- **WHEN** the pre-check returns the caller's own UUID
- **THEN** the OTP send SHALL proceed normally

#### Scenario: Pre-check inconclusive, fallback to error mapping

- **WHEN** the caller is unverified so `find_user_by_phone` returns NULL
- **AND** Supabase responds with an error matching `/already|exists|registered|in use/i`
- **THEN** the error SHALL be re-thrown as `PhoneAlreadyRegisteredError`

#### Scenario: Unrelated Supabase error preserved

- **WHEN** `supabase.auth.updateUser` returns a different error (e.g. invalid format, rate limit)
- **THEN** the original error SHALL be propagated unchanged

### Requirement: Localized conflict error message

When `PhoneAlreadyRegisteredError` propagates to the UI, the user-facing error SHALL be rendered inline beneath the phone input field using the i18n key `user.phoneVerification.alreadyRegisteredError`. The localized copy SHALL state that the phone number is already registered on TourenBuddy and direct the user to `feedback@tourenbuddy.ch` if they believe they have another account with the same number.

#### Scenario: Inline rendering

- **WHEN** `PhoneAlreadyRegisteredError` is thrown by the store
- **THEN** the profile edit form SHALL display the localized message beneath the phone input
- **AND** SHALL NOT navigate to the OTP entry step

#### Scenario: Localization coverage

- **WHEN** the UI is rendered in `en` or `de-CH`
- **THEN** the message SHALL be sourced from the locale file and include the literal string `feedback@tourenbuddy.ch`
