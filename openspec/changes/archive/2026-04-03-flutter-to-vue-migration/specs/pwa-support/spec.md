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
