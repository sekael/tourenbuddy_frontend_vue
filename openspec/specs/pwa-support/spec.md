## ADDED Requirements

### Requirement: PWA configured with vite-plugin-pwa

The app SHALL be configured as a Progressive Web App using `vite-plugin-pwa` with `registerType: 'prompt'`, a web app manifest (app name, icons, theme color, start URL), and Workbox `generateSW` for precaching static assets.

#### Scenario: App installable as PWA

- **WHEN** the app is served over HTTPS
- **THEN** browsers SHALL recognize the app as installable via the web app manifest

#### Scenario: Service worker precaches app shell

- **WHEN** the service worker activates
- **THEN** it SHALL precache the app shell (HTML, CSS, JS bundles) for offline access

### Requirement: Swisstopo tile caching

The service worker SHALL cache Swisstopo map tiles using a `StaleWhileRevalidate` strategy for offline map access.

#### Scenario: Tile served from cache

- **WHEN** the user views a previously visited map area while offline
- **THEN** the cached Swisstopo tiles SHALL be served from the service worker cache

#### Scenario: Tile updated in background

- **WHEN** the user views a previously visited map area while online
- **THEN** the cached tile SHALL be served immediately and updated in the background

### Requirement: PWA install prompt banner

A banner component SHALL prompt users to install the app when the browser's `beforeinstallprompt` event fires.

#### Scenario: Install prompt shown

- **WHEN** the browser fires `beforeinstallprompt`
- **THEN** a banner SHALL appear offering to install the app

#### Scenario: User dismisses prompt

- **WHEN** the user dismisses the install banner
- **THEN** the banner SHALL hide and not reappear during the session

#### Scenario: User accepts install

- **WHEN** the user clicks "Install" on the banner
- **THEN** the browser's native install prompt SHALL be triggered

### Requirement: Service worker update prompt

The app SHALL register the service worker via `virtual:pwa-register/vue` and prompt the user when a new version is waiting to activate.

#### Scenario: New version detected

- **WHEN** the service worker reports `onNeedRefresh` (a new SW is in `waiting` state)
- **THEN** the app SHALL display a persistent UI prompt offering to reload to the new version

#### Scenario: User accepts update

- **WHEN** the user clicks the reload action on the update prompt
- **THEN** the app SHALL call `updateSW(true)` so the waiting service worker activates and the page reloads to the new version

#### Scenario: User dismisses update prompt

- **WHEN** the user dismisses the update prompt without reloading
- **THEN** the prompt SHALL hide for the current session and the new SW SHALL remain in `waiting` state until the next reload

### Requirement: Outdated precache cleanup

The Workbox configuration SHALL set `cleanupOutdatedCaches: true` and `clientsClaim: true` so that stale precache entries from prior service worker versions are removed on activation and the new SW claims open clients.

#### Scenario: Stale precache removed on activation

- **WHEN** a new service worker activates after a deploy
- **THEN** Workbox SHALL delete precache entries belonging to previous SW revisions

### Requirement: Cloudflare Pages cache-control headers

A `public/_headers` file SHALL define Cloudflare Pages response headers so that entry-point resources are not browser-cached and hashed assets are cached immutably.

#### Scenario: Entry-point resources revalidate

- **WHEN** the browser requests `/index.html`, `/sw.js`, `/registerSW.js`, or `/manifest.webmanifest`
- **THEN** the response SHALL include a `Cache-Control` header that prevents stale browser cache reuse (`no-cache` or `no-store, must-revalidate`)

#### Scenario: Hashed assets cached immutably

- **WHEN** the browser requests any file under `/assets/*` (Vite content-hashed bundles)
- **THEN** the response SHALL include `Cache-Control: public, max-age=31536000, immutable`
