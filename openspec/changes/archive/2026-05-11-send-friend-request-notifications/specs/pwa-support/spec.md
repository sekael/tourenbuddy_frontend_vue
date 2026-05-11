## ADDED Requirements

### Requirement: Service worker push handler
The service worker SHALL handle `push` events by displaying a notification with the title and body provided by the Worker payload.

#### Scenario: Push event received
- **WHEN** the service worker receives a `push` event with a JSON payload `{ title, body, url }`
- **THEN** it shows a notification using `registration.showNotification(title, { body, data: { url } })`

#### Scenario: Empty or malformed payload
- **WHEN** the payload cannot be parsed as JSON
- **THEN** a generic localized fallback notification is shown

### Requirement: Service worker notification click handler
The service worker SHALL focus an existing client window or open a new one at the notification's deep-link URL when the user taps a notification.

#### Scenario: App already open
- **WHEN** the user clicks the notification and a window for the app origin is already open
- **THEN** that window is focused and navigated to `event.notification.data.url`

#### Scenario: App not open
- **WHEN** no window is open for the origin
- **THEN** the service worker opens a new window at the deep-link URL

### Requirement: Web Push subscription on permission grant
The PWA SHALL subscribe the browser to Web Push using the VAPID public key whenever the user enables push and notification permission is granted.

#### Scenario: Permission granted
- **WHEN** the user toggles push on and `Notification.permission === 'granted'`
- **THEN** the app calls `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })` and stores the subscription

#### Scenario: Permission denied
- **WHEN** the user denies permission
- **THEN** the push toggle reverts to off and a hint explains how to re-enable it in browser settings
