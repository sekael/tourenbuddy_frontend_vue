## ADDED Requirements

### Requirement: Native device push token registration
The system SHALL store one row per native device push token in `device_push_tokens` (platform `ios` or `android`, token, app id, APNs environment for iOS, app version), written only through the `register_device_push_token` RPC, which SHALL require an authenticated caller, validate its arguments and give the token to the caller even if another account registered it before. Users SHALL read and delete only their own rows and SHALL have no direct insert or update.

#### Scenario: Device registers
- **WHEN** a signed-in native app calls `register_device_push_token` with its token
- **THEN** a row for the caller exists with that token, platform, app id, environment and app version, and `last_seen_at` is now

#### Scenario: Token previously owned by another account
- **WHEN** user B registers a token that is registered to user A
- **THEN** the token's row belongs to B and A no longer receives push on that device

#### Scenario: Unauthenticated or invalid call
- **WHEN** the RPC is called without a session, with an unknown platform, an app id other than the TourenBuddy apps, or an iOS token without an APNs environment
- **THEN** it raises and nothing is written

#### Scenario: Another user's rows
- **WHEN** a user selects, updates or deletes `device_push_tokens` rows of another user
- **THEN** no row is returned or changed

### Requirement: Native push delivery
The Worker SHALL send every push it sends to a user to each of the user's native device tokens as well as to their Web Push subscriptions: iOS tokens directly through APNs (token authentication, the row's app id as topic, the sandbox host for `development` tokens) and Android tokens through FCM HTTP v1. Each push SHALL carry the localized title and body and the URL `<APP_URL>/?notification=<entry id>`. A platform whose credentials are not configured SHALL be skipped without failing the event.

#### Scenario: User with a phone and a browser
- **WHEN** an event is delivered to a user with an iOS token and a Web Push subscription
- **THEN** APNs receives an alert with the title, body and URL for the iOS token, and the browser receives the Web Push

#### Scenario: Development build
- **WHEN** the token's APNs environment is `development`
- **THEN** the Worker sends to `api.sandbox.push.apple.com`

#### Scenario: Credentials missing
- **WHEN** the APNs or FCM secrets are not set
- **THEN** that platform's tokens get nothing, the other channels deliver, and the event answers 200

### Requirement: App icon badge
Every APNs push SHALL set the app icon's badge to the recipient's unread inbox entries, and SHALL be sent without a badge when that count fails.

#### Scenario: Unread entries
- **WHEN** an event is delivered to an iOS token of a user with three unread inbox entries
- **THEN** the APNs payload sets the badge to 3

#### Scenario: Count fails
- **WHEN** counting the unread entries fails
- **THEN** the alert is still sent, without a badge

### Requirement: Stale native token cleanup
The Worker SHALL delete a device token row when APNs answers `Unregistered`, `BadDeviceToken` or `DeviceTokenNotForTopic`, or FCM answers `UNREGISTERED` or an `INVALID_ARGUMENT` that names the token, and SHALL keep the row on any other error: authentication, rate limit, a payload FCM rejects, server or network.

#### Scenario: App uninstalled
- **WHEN** APNs answers 410 `Unregistered` for a token
- **THEN** that token's row is deleted

#### Scenario: Provider outage
- **WHEN** FCM answers 503
- **THEN** the row is kept and the failure is logged
