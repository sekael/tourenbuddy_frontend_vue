## Why

After deploys to Cloudflare Pages, users keep seeing old app version until they manually clear site data. Two root causes: (1) `vite-plugin-pwa` is configured with `registerType: 'prompt'` but the app never wires `useRegisterSW` — new service worker enters `waiting` state and never activates; (2) no `_headers` file controls Cloudflare Pages caching, so `index.html` and the service worker script can be cached by the browser/CDN, masking new deploys. Resolves issue #131.

## What Changes

- Add `public/_headers` for Cloudflare Pages: `no-cache` for `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`; long `immutable` for hashed assets in `/assets/*`.
- Wire PWA update flow via `virtual:pwa-register/vue` (`useRegisterSW`) in app bootstrap.
- New snackbar/banner UI prompting "New version available — reload" that calls `updateSW(true)` to skip waiting and reload.
- Add `cleanupOutdatedCaches: true` and `clientsClaim: true` to Workbox config so stale precache entries are removed on activation.
- Add i18n keys for update prompt in `en.json` and `de-CH.json`.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `pwa-support`: add requirements for SW update prompt activation, outdated cache cleanup, and Cloudflare Pages cache-control headers.

## Impact

- `vite.config.ts` — Workbox `cleanupOutdatedCaches`, `clientsClaim`.
- `public/_headers` — new file (Cloudflare Pages convention).
- `src/app/` — register SW + mount update-available UI.
- `src/core/components/` — new update prompt component (or reuse snackbar).
- `src/locales/en.json`, `src/locales/de-CH.json` — new keys.
- No backend / DB impact.
