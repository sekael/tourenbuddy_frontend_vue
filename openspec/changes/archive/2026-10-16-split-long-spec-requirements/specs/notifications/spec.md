# Spec Delta

## REMOVED Requirements

### Requirement: Notification preference channels

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "Push and email notification channels", "Mutable notification types", "Channels and mutes govern push and email only", "New notification types are delivered by default", "Release notes are not a mutable type", "`friend_requests` notification type", "`tour_updates` notification type", "`tour_interest` notification type", "`tour_suggestions` notification type", "`availability` notification type", "`tour_reminders` notification type".

## ADDED Requirements

### Requirement: Push and email notification channels

The system SHALL allow each user to independently enable or disable push and email notification channels. The email channel is an account-wide setting; the push channel is a per-device setting (see "Per-device push toggle").

#### Scenario: Defaults on first profile creation
- **WHEN** a new user profile is created
- **THEN** the email channel is disabled (`notif_email_enabled = false`, opt-in required), push is off on every device until enabled there, and no notification types are muted

#### Scenario: User disables a channel
- **WHEN** the user toggles the email channel off in profile preferences
- **THEN** the system persists `notif_email_enabled = false` and no further email notifications are sent for any type to that user

### Requirement: Mutable notification types

The system SHALL allow each user to mute specific notification types from a defined, extensible set. The set defines six types, each scoped by its own requirement: `friend_requests`, `tour_updates`, `tour_interest`, `tour_suggestions`, `availability`, and `tour_reminders`.

#### Scenario: Type set is extensible without schema change
- **WHEN** a future notification type is introduced (e.g. `tour_invites`)
- **THEN** it is added to the TypeScript union and i18n keys only; `notif_muted_types` accepts the new value without DB migration

### Requirement: Channels and mutes govern push and email only

Channels and mutes SHALL govern push and email delivery only; they SHALL NOT affect the in-app notification inbox, which records every event.

#### Scenario: Mute copy states inbox still records
- **WHEN** the preferences UI renders the muted-types section
- **THEN** it states that muting silences push and email only and events still appear in the inbox

### Requirement: New notification types are delivered by default

New notification types SHALL be delivered by default; existing users are not muted for them.

#### Scenario: New types on by default
- **WHEN** an existing user with push enabled has never changed their mutes
- **THEN** they receive availability summaries and tour reminders by push

### Requirement: Release notes are not a mutable type

Release-note inbox entries SHALL NOT be a mutable type: they are never pushed or emailed.

#### Scenario: Release notes not listed
- **WHEN** the preferences UI renders the muted-types section
- **THEN** it lists the six mutable types and no release-notes row

### Requirement: `friend_requests` notification type

The `friend_requests` type SHALL cover friend-request received and responded events.

#### Scenario: User mutes friend_requests
- **WHEN** the user mutes `friend_requests`
- **THEN** that type is added to `notif_muted_types` and no friend-request-related push or email (received or responded) is sent, regardless of channel state, while inbox entries are still recorded

### Requirement: `tour_updates` notification type

The `tour_updates` type SHALL cover shared-tour created, edited, or deleted events.

#### Scenario: User mutes tour_updates
- **WHEN** the user mutes `tour_updates`
- **THEN** that type is added to `notif_muted_types` and no shared-tour change push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

### Requirement: `tour_interest` notification type

The `tour_interest` type SHALL cover a friend having planned the same tour as one of yours, a link request between your tours being created, accepted, or declined, and the friendship-accept backfill digest. The enum value `'tour_interest'` SHALL be retained unchanged; only the user-facing label and description in the preferences UI SHALL be reworded to reflect the collaboration-suggestion semantics.

#### Scenario: User mutes tour_interest
- **WHEN** the user mutes `tour_interest`
- **THEN** that type is added to `notif_muted_types` and no collision-detected, link-request-lifecycle, or friendship-backfill digest push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: tour_interest label reflects collaboration-suggestion semantics
- **WHEN** the preferences UI renders the `tour_interest` row
- **THEN** the label and description describe same-tour collaboration suggestions (collision-detected pings, link-request events, friendship backfill) — not the legacy "decline duplicate" behavior

### Requirement: `tour_suggestions` notification type

The `tour_suggestions` type SHALL cover a partner proposing changes to your tour, or your own proposal being accepted or declined. It SHALL be a distinct mutable type rather than folded into `tour_updates`: a user who does not want to hear about every edit to a shared tour may still want to hear that someone is waiting on their decision.

#### Scenario: User mutes tour_suggestions
- **WHEN** the user mutes `tour_suggestions`
- **THEN** that type is added to `notif_muted_types` and neither suggestion-submitted nor suggestion-resolved push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

#### Scenario: Muting tour_updates leaves suggestions audible
- **WHEN** the user has muted `tour_updates` but not `tour_suggestions`
- **THEN** a partner's submitted suggestion on their tour is still delivered by push/email

### Requirement: `availability` notification type

The `availability` type SHALL cover the weekly summary of friends you share a tour with who are free on days you are free.

#### Scenario: User mutes availability
- **WHEN** the user mutes `availability`
- **THEN** that type is added to `notif_muted_types` and no weekly availability summary push or email is sent to that user, regardless of channel state, while inbox entries are still recorded

### Requirement: `tour_reminders` notification type

The `tour_reminders` type SHALL cover one of your tours, or a friend's tour you are a partner on, being five days away.

#### Scenario: User mutes tour_reminders
- **WHEN** the user mutes `tour_reminders`
- **THEN** that type is added to `notif_muted_types` and no tour reminder push or email is sent to that user, regardless of channel state, while inbox entries are still recorded
