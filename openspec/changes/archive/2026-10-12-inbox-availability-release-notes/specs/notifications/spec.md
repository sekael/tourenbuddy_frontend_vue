# Spec Delta

## MODIFIED Requirements

### Requirement: Notification preference channels
The system SHALL allow each user to independently enable or disable push and email notification channels, and to mute specific notification types from a defined, extensible set. Channels and mutes SHALL govern push and email delivery only; they SHALL NOT affect the in-app notification inbox, which records every event. The email channel is an account-wide setting; the push channel is a per-device setting (see "Per-device push toggle"). The set defines six types: `friend_requests` (received and responded events), `tour_updates` (shared-tour created, edited, or deleted events), `tour_interest` (a friend has planned the same tour as one of yours, or a link request between your tours is created, accepted, or declined; also the friendship-accept backfill digest), `tour_suggestions` (a partner proposed changes to your tour, or your own proposal was accepted or declined), `availability` (the weekly summary of friends you share a tour with who are free on days you are free), and `tour_reminders` (one of your tours, or a friend's tour you are a partner on, is five days away). New types SHALL be delivered by default; existing users are not muted for them. Release-note inbox entries SHALL NOT be a mutable type: they are never pushed or emailed. The enum value `'tour_interest'` SHALL be retained unchanged; only the user-facing label and description in the preferences UI SHALL be reworded to reflect the collaboration-suggestion semantics.

`tour_suggestions` SHALL be a distinct mutable type rather than folded into `tour_updates`: a user who does not want to hear about every edit to a shared tour may still want to hear that someone is waiting on their decision.

#### Scenario: Defaults on first profile creation
- **WHEN** a new user profile is created
- **THEN** push and email channels are both disabled (opt-in required) and no notification types are muted

#### Scenario: User disables a channel
- **WHEN** the user toggles the email channel off in profile preferences
- **THEN** the system persists `notif_email_enabled = false` and no further email notifications are sent for any type to that user

#### Scenario: User mutes friend_requests
- **WHEN** the user mutes `friend_requests`
- **THEN** that type is added to `notif_muted_types` and no friend-request-related push or email (received or responded) is sent, regardless of channel state, while inbox entries are still recorded

#### Scenario: User mutes tour_updates
- **WHEN** the user mutes `tour_updates`
- **THEN** that type is added to `notif_muted_types` and no shared-tour change push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: User mutes tour_interest
- **WHEN** the user mutes `tour_interest`
- **THEN** that type is added to `notif_muted_types` and no collision-detected, link-request-lifecycle, or friendship-backfill digest push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: User mutes tour_suggestions
- **WHEN** the user mutes `tour_suggestions`
- **THEN** that type is added to `notif_muted_types` and neither suggestion-submitted nor suggestion-resolved push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: Muting tour_updates leaves suggestions audible
- **WHEN** the user has muted `tour_updates` but not `tour_suggestions`
- **THEN** a partner's submitted suggestion on their tour is still delivered by push/email

#### Scenario: tour_interest label reflects collaboration-suggestion semantics
- **WHEN** the preferences UI renders the `tour_interest` row
- **THEN** the label and description describe same-tour collaboration suggestions (collision-detected pings, link-request events, friendship backfill) — not the legacy "decline duplicate" behavior

#### Scenario: Mute copy states inbox still records
- **WHEN** the preferences UI renders the muted-types section
- **THEN** it states that muting silences push and email only and events still appear in the inbox

#### Scenario: Type set is extensible without schema change
- **WHEN** a future notification type is introduced (e.g. `tour_invites`)
- **THEN** it is added to the TypeScript union and i18n keys only; `notif_muted_types` accepts the new value without DB migration

#### Scenario: User mutes availability
- **WHEN** the user mutes `availability`
- **THEN** that type is added to `notif_muted_types` and no weekly availability summary push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: User mutes tour_reminders
- **WHEN** the user mutes `tour_reminders`
- **THEN** that type is added to `notif_muted_types` and no tour reminder push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: New types on by default
- **WHEN** an existing user with push enabled has never changed their mutes
- **THEN** they receive availability summaries and tour reminders by push

#### Scenario: Release notes not listed
- **WHEN** the preferences UI renders the muted-types section
- **THEN** it lists the six mutable types and no release-notes row
