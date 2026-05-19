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
