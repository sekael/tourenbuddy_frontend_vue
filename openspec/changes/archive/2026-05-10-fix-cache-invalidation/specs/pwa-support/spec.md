## ADDED Requirements

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
