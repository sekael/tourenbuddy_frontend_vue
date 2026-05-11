## ADDED Requirements

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
