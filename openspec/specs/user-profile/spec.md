## ADDED Requirements

### Requirement: User can remove phone number from profile

The profile edit form SHALL expose a "Remove phone number" action that, when invoked, deletes the user's phone number from the auth user record (`auth.users.phone` and `phone_confirmed_at` cleared) and removes the corresponding `auth.identities` row with `provider='phone'`, so the same number can subsequently be verified by another user.

The action SHALL be invokable via a SECURITY DEFINER RPC `delete_own_phone()` operating strictly on `auth.uid()`.

#### Scenario: Verified phone — confirmation with disclaimer

- **WHEN** the user opens profile edit and the current phone is verified (`phone_confirmed_at` is not null)
- **AND** taps "Remove phone number"
- **THEN** a confirmation overlay SHALL be rendered with a disclaimer that re-adding the number will require reverification
- **AND** the deletion SHALL only execute after the user confirms

#### Scenario: Unverified phone — immediate deletion, no disclaimer

- **WHEN** the user opens profile edit and the current phone is unverified
- **AND** taps "Remove phone number"
- **THEN** the deletion SHALL execute immediately without rendering the reverification disclaimer

#### Scenario: Auth records cleared

- **WHEN** `delete_own_phone()` completes successfully
- **THEN** `auth.users.phone` and `auth.users.phone_confirmed_at` for the caller SHALL be `NULL`
- **AND** no `auth.identities` row with `provider='phone'` SHALL remain for the caller
- **AND** the reactive `fullProfile` SHALL reflect `phoneNumber: null` and `phoneVerified: false` without requiring a page reload

#### Scenario: Number reusable by another user after deletion

- **WHEN** user A deletes their verified phone via this flow
- **AND** user B subsequently verifies the same E.164 number
- **THEN** user B's verification SHALL succeed without an "already registered" conflict

#### Scenario: Responsive presentation

- **WHEN** the confirmation overlay is rendered on a mobile viewport
- **THEN** it SHALL appear as a bottom sheet (via existing `AdaptiveOverlay`)
- **WHEN** rendered on desktop
- **THEN** it SHALL appear as a centered dialog

#### Scenario: RPC failure surfaces error

- **WHEN** the RPC returns an error
- **THEN** the store's `error` ref SHALL be set, the phone SHALL remain unchanged, and a localized failure message SHALL be displayed in the form

### Requirement: Notification preference fields on user profile
The user profile SHALL persist notification channel toggles and a list of muted notification types.

#### Scenario: New columns present
- **WHEN** a user profile is read
- **THEN** the result includes `notif_push_enabled: boolean`, `notif_email_enabled: boolean`, and `notif_muted_types: string[]`

#### Scenario: Defaults
- **WHEN** a profile row is created without explicit notification fields
- **THEN** push and email default to enabled and muted types defaults to empty

### Requirement: Profile preferences UI for notifications
The profile page SHALL include a notifications section exposing channel toggles, per-type mute switches, and the all-channels-off disclaimer.

#### Scenario: Renders toggles
- **WHEN** the user opens profile preferences
- **THEN** the notifications section renders push channel, email channel, and per-type toggles for each supported notification type

#### Scenario: All channels off
- **WHEN** push and email are both disabled
- **THEN** the section shows the disclaimer warning the user may miss friend requests and other important updates
