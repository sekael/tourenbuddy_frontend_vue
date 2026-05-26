## MODIFIED Requirements

### Requirement: Notification preference channels
The system SHALL allow each user to independently enable or disable push and email notification channels, and to mute specific notification types from a defined, extensible set. The set defines three types: `friend_requests` (received and responded events), `tour_updates` (shared-tour created, edited, or deleted events), and `tour_interest` (a friend declined a duplicate and expressed interest in a tour).

#### Scenario: Defaults on first profile creation
- **WHEN** a new user profile is created
- **THEN** push and email channels are both disabled (opt-in required) and no notification types are muted

#### Scenario: User disables a channel
- **WHEN** the user toggles the email channel off in profile preferences
- **THEN** the system persists `notif_email_enabled = false` and no further email notifications are sent for any type to that user

#### Scenario: User mutes friend_requests
- **WHEN** the user mutes `friend_requests`
- **THEN** that type is added to `notif_muted_types` and no friend-request-related notifications (received or responded) are dispatched, regardless of channel state

#### Scenario: User mutes tour_updates
- **WHEN** the user mutes `tour_updates`
- **THEN** that type is added to `notif_muted_types` and no shared-tour change notifications are dispatched to that user, regardless of channel state

#### Scenario: User mutes tour_interest
- **WHEN** the user mutes `tour_interest`
- **THEN** that type is added to `notif_muted_types` and no tour-interest notifications are dispatched to that user, regardless of channel state

#### Scenario: Type set is extensible without schema change
- **WHEN** a future notification type is introduced (e.g. `tour_invites`)
- **THEN** it is added to the TypeScript union and i18n keys only; `notif_muted_types` accepts the new value without DB migration
