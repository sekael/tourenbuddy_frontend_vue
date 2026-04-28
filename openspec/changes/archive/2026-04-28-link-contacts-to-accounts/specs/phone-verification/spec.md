## ADDED Requirements

### Requirement: Verified phone is discoverable to other verified users

A user's phone number SHALL become discoverable to other verified users via the `find_user_by_phone` RPC if and only if `auth.users.phone_confirmed_at` is set for that user. Unverified phone numbers SHALL never appear in discovery results, regardless of whether a row exists in `auth.users.phone`.

#### Scenario: Phone marked verified

- **WHEN** a user successfully completes SMS OTP verification and `phone_confirmed_at` is set
- **THEN** subsequent verified-caller invocations of `find_user_by_phone` with that exact E.164 number SHALL return the user's id

#### Scenario: Phone unverified

- **WHEN** a user has a `phone` value but `phone_confirmed_at IS NULL`
- **THEN** `find_user_by_phone` invocations SHALL return `null` for that phone

### Requirement: Security notice before phone verification

The phone verification flow (onboarding form and profile edit) SHALL display a clear security notice to the user BEFORE the OTP is requested, explaining the discoverability and friendship-linking consequences of completing verification. The notice SHALL state that:

1. Once verified, other verified TouringBuddy users who add this phone number to their contacts will be informed that an account exists for that number and will be able to send a friend request.
2. No identity beyond the existence of an account is exposed by discovery.
3. Unverified phones are never discoverable.
4. The user has the unconditional right to deny any incoming friend request, and denial does not reveal that the recipient is the account behind the number beyond the act of declining.
5. Friendships can be revoked in the future (UI deferred but right is reserved).

The user SHALL explicitly acknowledge the notice (e.g. checkbox or "I understand, send code" button) before the OTP send action is dispatched. The acknowledgement SHALL block the verification submit when not given.

#### Scenario: Notice rendered before OTP send

- **WHEN** the user opens the phone-verification flow
- **THEN** the security notice SHALL be displayed before the SMS-send action is enabled

#### Scenario: Acknowledgement required

- **WHEN** the user attempts to send the OTP without acknowledging the notice
- **THEN** the send action SHALL remain disabled (or submit SHALL be blocked) and the notice SHALL be visually emphasized

#### Scenario: Notice copy translated

- **WHEN** the verification flow renders in `de-CH` or `en` locale
- **THEN** all notice text SHALL be sourced from the locale files via `t()` (no hard-coded strings)

#### Scenario: Re-verification re-shows notice

- **WHEN** a user replaces an already-verified phone with a new number
- **THEN** the notice SHALL be re-shown and re-acknowledged before the new OTP is sent

### Requirement: Verification status drives client UX gates

The frontend SHALL treat the calling user's `phone_confirmed_at` value as the single source of truth for whether to:

- invoke discovery RPCs (`find_user_by_phone`, `find_users_by_phones`)
- render connect prompts in contact forms or import results
- attempt to send friend requests

Unverified callers SHALL see no friendship discovery affordances anywhere in the app.

#### Scenario: Unverified caller sees no friendship UI

- **WHEN** the authenticated user has `phone_confirmed_at IS NULL`
- **THEN** discovery RPCs SHALL NOT be invoked AND connect prompts SHALL NOT be rendered AND the friend-requests inbox SHALL render only an empty state (or a "verify your phone to enable friends" hint)

#### Scenario: Caller becomes verified mid-session

- **WHEN** the user verifies their phone within a session and `phone_confirmed_at` transitions from null to a timestamp
- **THEN** the friendships store SHALL fetch lists and friendship UX SHALL be enabled without requiring a reload
