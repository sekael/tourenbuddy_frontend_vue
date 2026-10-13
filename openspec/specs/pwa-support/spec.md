## Purpose

Installable Progressive Web App with offline-capable shell, manifest, service worker, and runtime tile caching.

## Requirements

### Requirement: Installable app with a prompt-driven service worker
The app SHALL ship a web manifest (`TourenBuddy`, `display: standalone`, `start_url: /`, 192/512 px icons) and a custom service worker built with `vite-plugin-pwa` (`strategies: 'injectManifest'`, `src/sw.ts`, `registerType: 'prompt'`). The service worker SHALL precache the app shell (js, css, html, icons, svg, woff2) and SHALL serve the precached `index.html` for every in-app navigation, so client routes cold-start offline. A new service worker SHALL only take over after the user accepts the update prompt (see `app-update`), but an activated worker SHALL claim already-open clients immediately.

#### Scenario: Offline cold start on a client route
- **WHEN** the installed app is reopened offline on `/calendar`
- **THEN** the precached app shell is served and the app boots

### Requirement: Runtime caching rules
The service worker SHALL apply these runtime strategies:
- Swisstopo vector tiles (`vectortiles*.geo.admin.ch`): explicitly downloaded offline-map entries first (see `offline-map`), otherwise stale-while-revalidate in `swisstopo-tiles` (500 entries, 30 days).
- Swisstopo WMTS raster tiles: stale-while-revalidate (500 entries, 30 days).
- GPX objects in Supabase Storage: stale-while-revalidate (100 entries, 30 days).
- Tour attachment objects: network-only — signed URLs are short-lived and SHALL NOT be cached by the service worker.
- Welcome-screen background images: cache-first (4 entries, 30 days).

#### Scenario: Attachment fetch is never cached
- **WHEN** an attachment is fetched through a signed URL
- **THEN** the response does not enter any service-worker cache
### Requirement: Service worker push handler
The service worker SHALL handle `push` events by displaying a notification with the title and body provided by the Worker payload.

#### Scenario: Push event received
- **WHEN** the service worker receives a `push` event with a JSON payload `{ title, body, url }`
- **THEN** it shows a notification using `registration.showNotification(title, { body, data: { url } })`

#### Scenario: Empty or malformed payload
- **WHEN** the payload cannot be parsed as JSON, or lacks a field
- **THEN** a generic fallback is used for the missing part (title `TourenBuddy`, an English generic body, URL `/`) — the service worker has no access to the app's locale

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

Action bars, floating action buttons, bottom sheets, and any future bottom navigation SHALL apply the bottom safe-area inset via `var(--safe-bottom)` (on `padding-bottom` or `bottom`) so their touch targets sit fully above the Android gesture bar and the iOS home indicator. Non-interactive layers (map canvas, page background image) SHALL still extend behind the safe-area. The raw `env(safe-area-inset-bottom)` value SHALL be sourced only through the `--safe-bottom` token (defined in `safe-area.css`), not inline at the call site.

#### Scenario: Android PWA map action bar

- **WHEN** the user views the map on Android with gesture navigation enabled
- **THEN** the map action bar's buttons sit above the gesture bar and remain fully tappable

#### Scenario: iOS PWA bottom sheet

- **WHEN** a tour info bottom sheet is open on iOS PWA
- **THEN** its bottom-most interactive control is positioned above the home indicator

#### Scenario: Inset sourced from token

- **WHEN** an interactive control's CSS sets its bottom safe-area clearance
- **THEN** it references `var(--safe-bottom)` and contains no inline `env(safe-area-inset-bottom)`

### Requirement: Self-contained app shell (no external font origin)

The app shell SHALL be self-contained: all fonts and icons SHALL be bundled and precached by the service worker, with no runtime dependency on an external font CDN or any third-party origin for fonts or icons. Fonts and icons SHALL render on first paint and while offline.

#### Scenario: Icons and text render offline

- **WHEN** the app is opened offline (after installation)
- **THEN** Inter text and all icons render from precached bundle assets, with no failed third-party font requests

#### Scenario: No third-party font request on load

- **WHEN** the app loads with network access
- **THEN** no request is made to `fonts.googleapis.com` or `fonts.gstatic.com` (or any external font host)

#### Scenario: Icons present on first paint

- **WHEN** the first frame of the UI paints, before any deferred bootstrap work completes
- **THEN** icons already render at their correct size (bundled SVG), with no font-load race that could alter layout

