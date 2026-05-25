## Purpose

User profile fields (display name, locale, phone, avatar) with edit flows and validation.

## Requirements

### Requirement: Own-phone deletion cascades to friendships and pending friend requests

`public.delete_own_phone()` MUST, in the same transaction in which it clears `auth.users.phone` / `phone_confirmed_at` for the caller, also:
- DELETE every `friendships` row where the caller is `request_user_id` or `response_user_id`;
- UPDATE every `friend_requests` row with `status = 'pending'` where the caller is `from_user_id` to `status = 'cancelled', responded_at = now()`;
- UPDATE every `friend_requests` row with `status = 'pending'` where the caller is `to_user_id` to `status = 'denied', responded_at = now()`.

Rows with `status` other than `'pending'` MUST NOT be modified.

#### Scenario: Own-phone delete removes all caller friendships
- **WHEN** the caller invokes `delete_own_phone()` while having one or more `friendships` rows
- **THEN** every such `friendships` row is deleted in the same transaction

#### Scenario: Own-phone delete terminates caller pending requests
- **WHEN** the caller invokes `delete_own_phone()` while having pending `friend_requests` rows in either direction
- **THEN** every such pending row is terminated using the cancelled (sender) / denied (recipient) rule

#### Scenario: Non-pending requests survive own-phone delete
- **WHEN** the caller has historical `friend_requests` rows with status `denied` or `cancelled`
- **THEN** those rows are not modified

### Requirement: Delete-own-phone confirmation warns about friendship and pending-request side effects

The user profile UI MUST extend the existing delete-own-phone confirmation (reverify disclaimer) with an additional localized warning when the caller has at least one existing `friendships` row and/or at least one pending `friend_requests` row at the time the dialog opens. The warning MUST identify the side effect (friendships will be removed, pending requests will be cancelled, or both).

#### Scenario: Warning shown when relationships exist
- **WHEN** the user opens the delete-own-phone confirmation while having any friendship or pending request
- **THEN** the confirmation dialog displays the localized side-effect warning in addition to the existing reverify disclaimer

#### Scenario: No relationship warning when none exist
- **WHEN** the user opens the delete-own-phone confirmation while having no friendships and no pending requests
- **THEN** only the existing reverify disclaimer is shown

#### Scenario: Confirming the delete performs cleanup
- **WHEN** the user confirms own-phone deletion for which the relationship warning was displayed
- **THEN** `delete_own_phone()` is invoked and the database performs friendship deletion and pending-request termination as specified

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
