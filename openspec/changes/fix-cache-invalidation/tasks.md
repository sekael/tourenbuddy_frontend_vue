# Tasks

## 1. Git Setup
- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b fix/131-cache-invalidation`

## 2. Workbox + PWA config (`vite.config.ts`)
- [x] 2.1 Add `cleanupOutdatedCaches: true` and `clientsClaim: true` to `workbox` block
- [x] 2.2 Add `injectRegister: false` to PWA options (we register via `useRegisterSW`)
- [x] 2.3 Keep `registerType: 'prompt'`

## 3. Cloudflare Pages headers
- [x] 3.1 Create `public/_headers` with rules in this order: `/assets/*` immutable; `/icons/*` `max-age=86400`; `/workbox-*.js` immutable; `/index.html`, `/sw.js`, `/manifest.webmanifest` `no-cache`; catch-all `/*` `max-age=0, must-revalidate`
- [x] 3.2 Run `npm run build` and confirm `dist/_headers` present and `dist/registerSW.js` absent

## 4. SW registration composable
- [x] 4.1 Add `vite-plugin-pwa/client` to `tsconfig` types so `virtual:pwa-register/vue` resolves
- [x] 4.2 Create `src/core/composables/use-pwa-update.ts`:
  - Call `useRegisterSW({ immediate: true })`
  - Expose `{ needRefresh, accept, dismiss }`
  - `accept()` → `updateSW(true)`; `dismiss()` → `needRefresh.value = false`
  - Subscribe to `navigator.serviceWorker.controllerchange`; when `document.visibilityState === 'visible'` and not already in user-accept reload path, call `window.location.reload()` once (module-level flag guards double-reload)
- [x] 4.3 Mount composable in `App.vue` `<script setup>`
- [x] 4.4 Inspect `src/core/composables/use-snackbar.ts` — if it supports persistent (non-auto-dismiss) snackbar with action, render update prompt via snackbar; else create `src/core/components/update-prompt.vue` fixed banner with action + dismiss
- [x] 4.5 Use i18n keys for all user-facing strings

## 5. i18n
- [x] 5.1 Add `pwa.updateAvailable.message`, `pwa.updateAvailable.action`, `pwa.updateAvailable.dismiss` to `src/locales/en.json`
- [x] 5.2 Same keys with German translations in `src/locales/de-CH.json`

## 6. Tests
- [x] 6.1 `test/core/composables/use-pwa-update.test.ts` — mock `virtual:pwa-register/vue`:
  - `accept()` calls `updateSW(true)` exactly once
  - `dismiss()` sets `needRefresh.value = false`, never calls `updateSW`
  - `controllerchange` event with visible document → `location.reload` called once; second event in same lifetime → no second reload (guard works)
  - `controllerchange` when document hidden → no reload

## 7. Manual verification
- [x] 7.1 Push branch; deploy to Cloudflare preview branch
- [x] 7.2 Hit preview URL; in DevTools Network tab confirm `Cache-Control` per spec for `index.html`, `sw.js`, `/assets/*.js`, `/icons/*`
- [x] 7.3 Before merge: also check current production `test.tourenbuddy.ch` `index.html` response headers — confirm CF default revalidates (so bootstrap cohort unsticks within one reload)
- [ ] 7.4 Push a second preview deploy; with old tab still open confirm update prompt appears within one reload; clicking reload loads new version without manual site-data clear
- [ ] 7.5 Two-tab test: accept update in tab A → tab B reloads via `controllerchange` listener on next focus

## 8. Finalize
- [x] 8.1 `npx eslint . --fix` (zero warnings)
- [x] 8.2 `npm run type-check`
- [x] 8.3 `npm run test`
- [ ] 8.4 Prompt user to commit. Suggested message:
  ```
  fix(pwa): wire SW update prompt and Cloudflare cache headers (#131)

  - Add use-pwa-update composable with useRegisterSW + persistent prompt
  - Reload tab on controllerchange (multi-tab safety)
  - Workbox: cleanupOutdatedCaches, clientsClaim; injectRegister: false
  - public/_headers: no-cache for entry points, immutable for /assets/*
  - i18n keys for update prompt (en, de-CH)
  ```
- [ ] 8.5 Prompt user to push branch and open PR against `main` referencing issue #131
