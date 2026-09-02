## Purpose

Push and email notifications for friend requests, tour updates, and tour collaboration signals, gated by user preferences.

## Requirements

### Requirement: Notification preference channels
The system SHALL allow each user to independently enable or disable push and email notification channels, and to mute specific notification types from a defined, extensible set. The set defines four types: `friend_requests` (received and responded events), `tour_updates` (shared-tour created, edited, or deleted events), `tour_interest` (a friend has planned the same tour as one of yours, or a link request between your tours is created, accepted, or declined; also the friendship-accept backfill digest), and `tour_suggestions` (a partner proposed changes to your tour, or your own proposal was accepted or declined). The enum value `'tour_interest'` SHALL be retained unchanged; only the user-facing label and description in the preferences UI SHALL be reworded to reflect the collaboration-suggestion semantics.

`tour_suggestions` SHALL be a distinct mutable type rather than folded into `tour_updates`: a user who does not want to hear about every edit to a shared tour may still want to hear that someone is waiting on their decision.

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
- **THEN** that type is added to `notif_muted_types` and no collision-detected, link-request-lifecycle, or friendship-backfill digest notifications are dispatched to that user, regardless of channel state

#### Scenario: User mutes tour_suggestions
- **WHEN** the user mutes `tour_suggestions`
- **THEN** that type is added to `notif_muted_types` and neither suggestion-submitted nor suggestion-resolved notifications are dispatched to that user, regardless of channel state

#### Scenario: Muting tour_updates leaves suggestions audible
- **WHEN** the user has muted `tour_updates` but not `tour_suggestions`
- **THEN** a partner's submitted suggestion on their tour is still dispatched

#### Scenario: tour_interest label reflects collaboration-suggestion semantics
- **WHEN** the preferences UI renders the `tour_interest` row
- **THEN** the label and description describe same-tour collaboration suggestions (collision-detected pings, link-request events, friendship backfill) — not the legacy "decline duplicate" behavior

#### Scenario: Type set is extensible without schema change
- **WHEN** a future notification type is introduced (e.g. `tour_invites`)
- **THEN** it is added to the TypeScript union and i18n keys only; `notif_muted_types` accepts the new value without DB migration

### Requirement: Disclaimer when notifications are effectively off
The system SHALL display a warning in the profile preferences UI when both channels are disabled, or when both notification types are muted, informing the user they may miss incoming friend requests and other important updates.

#### Scenario: Both channels off
- **WHEN** the user has push and email both disabled
- **THEN** the preferences UI shows the disclaimer text

#### Scenario: At least one channel on
- **WHEN** the user has at least one channel enabled and no relevant type muted
- **THEN** the disclaimer is hidden

### Requirement: Web Push subscription registration
The system SHALL register a Web Push subscription per browser when the user grants notification permission, and SHALL support multiple devices per user.

#### Scenario: User grants permission
- **WHEN** the user enables push notifications and the browser grants permission
- **THEN** the client subscribes to Push using the VAPID public key and persists the resulting endpoint, p256dh, auth, and user agent in `push_subscriptions` for the current user

#### Scenario: Same browser already registered
- **WHEN** the same browser endpoint already exists for the user
- **THEN** the existing row is reused (unique on endpoint) and `last_seen_at` is refreshed

#### Scenario: User disables push
- **WHEN** the user turns push off
- **THEN** the client unsubscribes from the browser PushManager and deletes the matching row in `push_subscriptions`

### Requirement: iOS PWA gating
The system SHALL hide the push toggle when the client is iOS Safari and the app is not running in standalone (installed PWA) mode, and SHALL replace the toggle with a compact "unavailable" indicator that exposes the install-to-home-screen guidance via a tap- and hover-activated tooltip rather than rendering the guidance inline.

#### Scenario: iOS browser, not installed
- **WHEN** the user opens preferences in iOS Safari and `display-mode` is not `standalone`
- **THEN** the push toggle is hidden, a compact "Not available" badge with an info-icon button is shown in its place, and activating the info button reveals the install-to-home-screen guidance text

#### Scenario: iOS installed PWA
- **WHEN** the user opens preferences in an installed PWA on iOS 16.4+
- **THEN** the push toggle is shown and registration follows the standard Web Push flow

### Requirement: Compact unavailable indicator for push notifications
The notifications preferences UI SHALL present a single compact "unavailable" indicator in place of the push toggle whenever push notifications cannot be enabled on the current client — covering both the PWA-install-required case and the permission-denied case — and SHALL expose the full explanatory text only through an info-icon-triggered tooltip so the row remains single-line on mobile viewports across supported locales.

#### Scenario: Push permission denied
- **WHEN** the browser push permission state is `denied`
- **THEN** the push toggle is hidden and a compact "Not available" badge with an info-icon button is rendered in its place, the info button carries an accessible label equal to the full denial explanation, and activating it shows that explanation in a tooltip

#### Scenario: PWA install required
- **WHEN** push is supported by the browser but the app is not yet installed as a PWA
- **THEN** the push toggle is hidden and the same compact "Not available" badge + info-icon button is rendered, with the tooltip carrying the install-to-home-screen guidance

#### Scenario: Long-locale layout
- **WHEN** the active locale produces a long explanation string (e.g. German) and the viewport is narrow
- **THEN** the push row remains single-line because the long string lives inside the tooltip rather than inline in the row

### Requirement: Friend request received notification
The system SHALL notify the recipient of a new friend request through every enabled and non-muted channel they have configured. The event is internally classified under the `friend_requests` notification type.

#### Scenario: Recipient with push and email enabled
- **WHEN** a friend request is created
- **THEN** the recipient receives a Web Push to every active subscription AND an email via the locale-matching Brevo template, with body referencing the requester's display name

#### Scenario: Recipient muted friend_requests
- **WHEN** the recipient has muted the `friend_requests` type
- **THEN** no notification is dispatched for this event regardless of channel state

### Requirement: Friend request responded notification
The system SHALL notify the original requester when their friend request receives any response, without disclosing whether it was accepted or declined. The event is internally classified under the `friend_requests` notification type and is suppressed when that type is muted.

#### Scenario: Request accepted
- **WHEN** the recipient accepts the request
- **THEN** the requester receives notifications on enabled channels stating only that there was a response, never the outcome

#### Scenario: Request declined
- **WHEN** the recipient declines the request
- **THEN** the requester receives notifications on enabled channels stating only that there was a response, never the outcome

### Requirement: Localization of email content
The system SHALL select the Brevo template matching `user_profile.locale` (`en`, `de`) for each email notification.

#### Scenario: User locale is en
- **WHEN** dispatching an email to a user with locale `en`
- **THEN** the Worker uses the `*_en` template ID

#### Scenario: User locale is de
- **WHEN** dispatching an email to a user with locale `de`
- **THEN** the Worker uses the `*_de` template ID

#### Scenario: Unknown or missing locale
- **WHEN** the user locale is missing or not in the supported set
- **THEN** the Worker falls back to the `*_en` template

### Requirement: Notification dispatch authorization
The notification Worker SHALL verify the caller's Supabase JWT and SHALL reject requests where the caller is not the legitimate actor for the event. Network failures during JWT verification SHALL NOT block the client-side write; the verification failure is logged and the request is rejected with a clear error.

#### Scenario: Missing or invalid JWT
- **WHEN** the Worker receives a request without a valid `Authorization` bearer token
- **THEN** it responds 401 and dispatches nothing

#### Scenario: Caller is not the request sender
- **WHEN** `/notify/friend-request-received` is called and the JWT subject is not the `sender_id` on the friendship row
- **THEN** the Worker responds 403 and dispatches nothing

#### Scenario: Caller is not the responder
- **WHEN** `/notify/friend-request-responded` is called and the JWT subject is not the `recipient_id` on the friendship row
- **THEN** the Worker responds 403 and dispatches nothing

#### Scenario: JWT verification network failure
- **WHEN** the Worker cannot reach the Supabase authentication endpoint during JWT verification (network timeout, DNS failure, etc.)
- **THEN** the Worker logs the error and responds with a clear error message; the client-side write is not blocked or rolled back

### Requirement: Stale push subscription cleanup
The system SHALL delete push subscription rows whose endpoint returns 404 or 410 from the Web Push service.

#### Scenario: Endpoint expired
- **WHEN** the Worker dispatches a push and the response is 410 Gone
- **THEN** the matching row in `push_subscriptions` is deleted

### Requirement: Notification click deep link
A clicked push notification SHALL focus or open the app and navigate to the friend requests view.

#### Scenario: User clicks a friend request notification
- **WHEN** the user taps the notification
- **THEN** an existing app window is focused (or a new one opened) at a URL that opens the friend requests sheet
