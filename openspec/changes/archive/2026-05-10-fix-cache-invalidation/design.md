## Context

Production deploys to Cloudflare Pages (`test.tourenbuddy.ch`) leave clients on the previous app version until they manually clear site data. Investigation of `vite.config.ts` shows `VitePWA({ registerType: 'prompt', ... })` is configured but no code in `src/` calls `useRegisterSW` or imports `virtual:pwa-register`. Effect: build emits `sw.js` + `registerSW.js`, but app never registers update lifecycle — new SW reaches `waiting` and never activates while a tab stays open. Combined with Cloudflare Pages defaults that allow short browser caching of `index.html` and `sw.js`, this produces "stale forever" behavior.

Cloudflare Pages CDN itself purges per-deploy (each deploy is a versioned snapshot), so the lever is **browser cache + service worker activation**, not Cloudflare API purge calls.

## Goals / Non-Goals

**Goals:**
- New deploy reaches users without requiring manual cache/site-data clear.
- User-visible prompt on update (consistent with existing `registerType: 'prompt'`).
- Stale precache entries from prior versions removed.
- `index.html` + `sw.js` never cached by browser.

**Non-Goals:**
- Force-reload without consent (would interrupt in-flight tour edits).
- Custom Cloudflare Worker / API-driven purge.
- Offline-first data sync (out of scope, see architecture).
- Changing Swisstopo runtime cache strategy.

## Decisions

### Decision 1: Wire `useRegisterSW` from `virtual:pwa-register/vue`

Use the official Vue helper. On `onNeedRefresh`, show a snackbar/banner with reload CTA wired to `updateSW(true)`. Keep `registerType: 'prompt'`.

**Alternatives considered:**
- `registerType: 'autoUpdate'` — auto-applies, but reloads users mid-edit. Rejected.
- Custom registration via `navigator.serviceWorker.register` — re-implements lifecycle, more code. Rejected.

### Decision 2: `cleanupOutdatedCaches: true` + `clientsClaim: true`

`cleanupOutdatedCaches` deletes Workbox precache entries from old SW versions on activation. `clientsClaim` makes the new SW take control of open clients immediately after activation (still requires user-confirmed reload due to `prompt` mode).

**Alternative:** rely on default behavior. Rejected — old precache may linger.

### Decision 3: `public/_headers` for Cloudflare Pages

Cloudflare Pages reads `_headers` from build output to set response headers. First-match-wins per header, so order specific → general.

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=86400

/workbox-*.js
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/*
  Cache-Control: public, max-age=0, must-revalidate
```

- `/assets/*` and `/workbox-*.js` are content-hashed by Vite/vite-plugin-pwa → safe immutable.
- `/icons/*` referenced by manifest with stable filenames → 1 day, balance freshness vs traffic. Not `immutable` — icon redesign would otherwise require rename.
- `/index.html` and `/sw.js` use `no-cache` (etag revalidation, 304 cheap) instead of `no-store` — keeps revalidation traffic light while guaranteeing freshness.
- `registerSW.js` not listed: with `injectRegister: false` (Decision 5), no separate file is emitted.

**Alternative:** use Cloudflare dashboard Page Rules. Rejected — not in repo, drifts from code.

### Decision 4: Update prompt via composable + persistent UI

Bootstrap via `core/composables/use-pwa-update.ts` calling `useRegisterSW({ immediate: true })`. Composable returns `{ needRefresh, accept, dismiss }`. Mount once in `App.vue`.

UI: prefer existing `useSnackbar` if it supports a persistent (non-auto-dismiss) variant. Verify in `src/core/composables/use-snackbar.ts` before implementing — if absent, add `core/components/update-prompt.vue` (small fixed-position banner). Both routes use the same composable.

**Multi-tab safety:** composable also subscribes to `navigator.serviceWorker.controllerchange`. When controller swaps and `document.visibilityState === 'visible'`, reload once (guard with a module-level flag against double-reload during the user-accept path that already triggers reload via `updateSW(true)`).

### Decision 5: `injectRegister: false`

Disable vite-plugin-pwa's auto-injected registration script. We register exclusively through `useRegisterSW` from `virtual:pwa-register/vue`, bundled into the app chunk. Avoids a separate `registerSW.js` file and double-registration risk.

### Decision 6: Bootstrap cohort accepted

Users currently on the broken version have no update logic. Their next visit relies on the browser revalidating `index.html` (CF Pages default `max-age=0, must-revalidate` makes this likely within one reload). No proactive recovery shipped — verified via DevTools header check on production before merge. If observed default headers are worse, revisit.

## Risks / Trade-offs

- [Users ignore prompt] → Snackbar persists (no auto-dismiss); next navigation/tab focus re-evaluates. Acceptable; "prompt" mode is intentional.
- [`clientsClaim` + open multiple tabs] → New SW claims all tabs, but precache swap waits for reload. Mitigated by reload CTA scoping to current tab; other tabs prompt on next visibility change.
- [`_headers` syntax error breaks deploy] → Cloudflare logs warnings; verify locally with `wrangler pages dev` or staging branch before merging.
- [Service worker bug bricks app] → User can unregister via DevTools. Long-term: consider kill-switch route.

## Migration Plan

1. Land changes on feature branch, deploy to a Cloudflare preview branch.
2. Verify in preview: open old version in browser, push new deploy, confirm update prompt appears within ~1 reload.
3. Verify Network tab: `index.html` returns `cache-control: no-cache`; `/assets/*.js` returns `immutable`.
4. Merge to `main`. First production deploy after merge will still require one manual clear for users on the broken version (they have no update logic). Subsequent deploys propagate automatically.

**Rollback:** revert PR; previous SW continues serving old precache (no data loss).

## Open Questions

- None blocking. Future: add version display in app footer for support debugging.
