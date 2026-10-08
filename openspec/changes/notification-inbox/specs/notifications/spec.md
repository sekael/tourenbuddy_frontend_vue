# Spec Delta

## MODIFIED Requirements

### Requirement: Notification preference channels
The system SHALL allow each user to independently enable or disable push and email notification channels, and to mute specific notification types from a defined, extensible set. Channels and mutes SHALL govern push and email delivery only; they SHALL NOT affect the in-app notification inbox, which records every event. The email channel is an account-wide setting; the push channel is a per-device setting (see "Per-device push toggle"). The set defines four types: `friend_requests` (received and responded events), `tour_updates` (shared-tour created, edited, or deleted events), `tour_interest` (a friend has planned the same tour as one of yours, or a link request between your tours is created, accepted, or declined; also the friendship-accept backfill digest), and `tour_suggestions` (a partner proposed changes to your tour, or your own proposal was accepted or declined). The enum value `'tour_interest'` SHALL be retained unchanged; only the user-facing label and description in the preferences UI SHALL be reworded to reflect the collaboration-suggestion semantics.

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

### Requirement: Disclaimer when notifications are effectively off
The system SHALL display a hint in the profile preferences UI when push is off on this device and email is disabled, informing the user they will not be alerted outside the app and that updates still collect in the in-app inbox.

#### Scenario: Both channels off
- **WHEN** push is off on this device and email is disabled
- **THEN** the preferences UI shows the hint pointing to the inbox

#### Scenario: At least one channel on
- **WHEN** push is on for this device or email is enabled
- **THEN** the hint is hidden

### Requirement: Web Push subscription registration
The system SHALL register a Web Push subscription per browser when the user enables push on that device and permission is granted, and SHALL support any number of devices per user, each receiving every push sent to that user.

#### Scenario: User grants permission
- **WHEN** the user enables push on this device and the browser grants permission
- **THEN** the client subscribes to Push using the VAPID public key and persists the resulting endpoint, p256dh, auth, and user agent in `push_subscriptions` for the current user

#### Scenario: Same browser already registered
- **WHEN** the same browser endpoint already exists for the user
- **THEN** the existing row is reused (unique on endpoint) and `last_seen_at` is refreshed

#### Scenario: Second device registers
- **WHEN** a user with push enabled on a desktop browser enables push on their phone
- **THEN** both subscriptions exist and a subsequent notification is pushed to both devices

#### Scenario: User disables push
- **WHEN** the user turns push off on their phone while it is on for their desktop
- **THEN** the client unsubscribes the phone's browser PushManager and deletes only the phone's row; the desktop keeps receiving push

#### Scenario: Endpoint previously owned by another account
- **WHEN** user B enables push in a browser whose endpoint is still registered to user A
- **THEN** the endpoint is reassigned to B and A no longer receives push on that browser

## ADDED Requirements

### Requirement: Event dispatch authentication
The notification Worker SHALL only accept event dispatch requests originating from the database, authenticated by a shared secret, and SHALL reject all others. Client applications SHALL NOT be able to trigger push or email dispatch.

#### Scenario: Missing or wrong secret
- **WHEN** the Worker receives an event dispatch request without the correct shared secret
- **THEN** it responds 401 and dispatches nothing

#### Scenario: Client attempts dispatch
- **WHEN** an authenticated end-user client posts to the event dispatch endpoint with its own JWT
- **THEN** the Worker responds 401 and dispatches nothing

#### Scenario: Worker unreachable
- **WHEN** the database cannot reach the Worker for an emitted event
- **THEN** the originating write and the inbox entry remain committed, the push/email for that event is not delivered, and the failure is observable in the database's request log


### Requirement: Per-device push toggle
The push toggle SHALL reflect whether the current browser holds an active push subscription registered to the current user, not an account-wide flag. A newly used device SHALL show push as off until enabled there.

#### Scenario: New device
- **WHEN** a user with push enabled on desktop opens preferences on a phone for the first time
- **THEN** the phone's push toggle is off

#### Scenario: Subscription lost
- **WHEN** the browser's push subscription was revoked or expired
- **THEN** the toggle shows off on next open

### Requirement: Push delivery follows registered devices
Push SHALL be sent to a user iff they have at least one registered push subscription and the event's type is not muted; no account-level push flag SHALL gate delivery.

#### Scenario: No devices
- **WHEN** an event is emitted for a user with zero push subscriptions
- **THEN** no push is attempted

### Requirement: Sign-out removes this device's push registration
Signing out SHALL delete the current browser's push subscription row and unsubscribe its PushManager, so a shared device stops receiving the signed-out user's pushes. Other devices SHALL be unaffected.

#### Scenario: Sign out on shared tablet
- **WHEN** A signs out on a tablet with push enabled
- **THEN** the tablet receives no further push for A and A's other devices still do

## REMOVED Requirements

### Requirement: Notification dispatch authorization
**Reason**: Clients no longer call the Worker; events are emitted by the database, which already enforces that only the legitimate actor can perform each write. Per-endpoint JWT actor checks have nothing left to guard.
**Migration**: Replaced by "Event dispatch authentication" (shared-secret webhook from the database). Old `/notify/*` endpoints are removed; stale clients calling them get 404, which is harmless fire-and-forget.
