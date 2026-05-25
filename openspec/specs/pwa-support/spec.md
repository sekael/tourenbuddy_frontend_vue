## Purpose

Installable Progressive Web App with offline-capable shell, manifest, service worker, and runtime tile caching.

## Requirements

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

### Requirement: PWA pages extend content into safe-area zones

When installed as a PWA on iOS or Android, every routed page SHALL paint its own background (image, map canvas, or surface color) edge-to-edge of the device viewport, including beneath the top notch / status bar and the bottom home indicator / gesture bar. The body element SHALL NOT paint a brand-colored band in the safe-area.

#### Scenario: iOS PWA home page

- **WHEN** the user installs the app on iOS and opens the home page
- **THEN** the home page background image extends from the physical top edge to the physical bottom edge of the screen, with no solid blue band above it

#### Scenario: iOS PWA map view

- **WHEN** the user opens the map view in the installed iOS PWA
- **THEN** Swisstopo map tiles render under the notch and under the home indicator, with no solid color band

#### Scenario: Page mounted before content paints

- **WHEN** a route transition is in flight and a page root has not yet rendered its background
- **THEN** the visible fallback is the app's neutral surface color (not the legacy blue status-bar color)

### Requirement: Interactive controls stay clear of bottom safe-area

Action bars, floating action buttons, bottom sheets, and any future bottom navigation SHALL apply `padding-bottom: env(safe-area-inset-bottom)` (or equivalent margin) so their touch targets sit fully above the Android gesture bar and the iOS home indicator. Non-interactive layers (map canvas, page background image) SHALL still extend behind the safe-area.

#### Scenario: Android PWA map action bar

- **WHEN** the user views the map on Android with gesture navigation enabled
- **THEN** the map action bar's buttons sit above the gesture bar and remain fully tappable

#### Scenario: iOS PWA bottom sheet

- **WHEN** a tour info bottom sheet is open on iOS PWA
- **THEN** its bottom-most interactive control is positioned above the home indicator
