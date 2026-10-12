# Design

## Context

- `vite-plugin-pwa` with `registerType: 'prompt'`, `injectManifest` (`src/sw.ts` handles `SKIP_WAITING`, `clients.claim` on activate).
- `usePwaUpdate()` calls `useRegisterSW({ immediate: true })` and adds a `controllerchange` reload listener **per call**; `dismiss()` sets `needRefresh = false`, i.e. dismissing the banner forgets the update. Its only consumer today is `update-prompt.vue` (mounted once in `App.vue`).
- The browser only checks for a new service worker on navigation/registration, so an installed PWA left open never notices a deploy.
- Speed-dial wiring (after #311): `SpeedDialTrigger` takes `count` (inbox, wins) and `dot`; menu items take `badge` / `dot` (`use-map-overlay.ts`). The app version is not exposed to the bundle. `profile-overview.vue` is ~330 lines.

## Goals / Non-Goals

**Goals:** one registration shared by all consumers; update state independent of the banner; updates noticed in long-open sessions.

**Non-Goals:** showing the *new* version number (would need a version endpoint — the waiting SW doesn't carry it; owner agreed); forced updates / `skipWaiting` without user action; inbox entry for updates (future change); an unsaved-changes guard before reloading (none exists app-wide; the map shows one overlay at a time, so no tour/contact form is open behind the profile; queued writes are durable in IndexedDB); announcing the trigger's badge/dot to screen readers (existing gap, follow-up).

## Decisions

### D1 — Module-level singleton in `use-pwa-update.ts`
State lives at module scope, created on first call: `updateAvailable` (= `needRefresh`, only cleared by applying), `bannerDismissed` (in-memory ref, so the banner returns on the next app start — owner choice over remembering the dismissal), one `useRegisterSW` call, one `controllerchange` listener. `usePwaUpdate()` returns `{ updateAvailable, showBanner (computed: available && !dismissed), apply, dismissBanner }`.

`apply` works offline: a worker only reaches "waiting" after its precache installed, and the `injectManifest` glob precaches every JS chunk.
- *Alternative — Pinia store*: equivalent, but this is app-shell infrastructure in `core/` with no persistence or devtools need; a module singleton matches `use-online-status`.

### D2 — Foreground update check, throttled
`useRegisterSW({ immediate: true, onRegisteredSW(_, reg) { … } })` keeps the registration; on `visibilitychange` → visible it calls `reg.update()` if online and the last check was ≥ 15 min ago (the start-up registration counts as a check). A pending update surfaces through the existing `needRefresh`.
- *Alternative — hourly interval (+ foreground)*: a hidden PWA's timers are suspended on mobile anyway, and an update only matters when the user looks at the app; no interval means no timer to clean up. Owner chose foreground-only.
- Throttle: switching between the app and Maps/messengers while planning would otherwise fire a request per switch, competing with tiles on weak connections.

### D2b — Deferred reload for hidden windows
The `controllerchange` listener reloads immediately when visible (as today); when hidden it sets `reloadPending` and reloads on the next `visibilitychange` → visible. Today a hidden tab keeps old code under the new worker and 404s on its next lazy chunk (old hashes are in neither the new precache nor the new deployment).
- *Alternative — reload hidden tabs immediately*: can drop state the user expects on return. Rejected.

### D3 — App version from `package.json` via Vite `define`; commit only on previews
`define: { __APP_VERSION__: JSON.stringify(pkg.version) }` + `declare const __APP_VERSION__: string` in `env.d.ts`, mirrored in the Vitest config. release-please bumps `package.json` in the release PR, so the deploy build carries the released version. (The planned `inbox-availability-release-notes` change reuses this define — its task 5.1 shrinks to a reuse.)

Suffix: `deploy-preview.yml`'s Create Env File step writes `VITE_BUILD_COMMIT=${{ github.event.pull_request.head.sha }}` (same SHA its sticky comment prints); `core/constants/env.ts` gains it as optional. Label = `Version x.y.z`, plus ` · <first 7 chars>` when `VITE_BUILD_COMMIT` is set, else ` · dev` when `import.meta.env.DEV`. Production writes nothing new, so it shows the version only.
- *Alternative — `git rev-parse` in `vite.config.ts`*: PR checkouts build the merge commit, not the head SHA testers see; and production would need an extra flag to hide it. Rejected.

### D4 — Notice on top, version at the bottom (two small components)
In `features/user/presentation/components/`: `app-update-notice.vue` — first row of the profile overview while `updateAvailable`: banner copy (`core.pwa.update.message`) + primary `BaseButton` (`core.pwa.update.action`) calling `apply()`; `app-version-line.vue` — last element, label per D3 in `--color-on-surface-variant`, small text. The dot leads into the profile, so its reason must be visible without scrolling; the version is reference info where "about" details are expected. Extracted to keep `profile-overview.vue` from growing past the ~150-line guideline.

### D5 — Dots reuse the existing props; profile item gets an accessible name
`use-map-overlay.ts`: profile item `dot: updateAvailable` and, while pending, an accessible label `map.overlay.profileUpdateAvailable` ("Profile, update available"). `map-action-overlay.vue`: trigger `:dot="pendingIncomingCount > 0 || updateAvailable"`; `count` keeps precedence inside `SpeedDialTrigger` (unchanged) — the update is never more urgent than unread entries. The speed dial is the only profile entry on mobile and desktop, so these two dots cover every path.

## Risks / Trade-offs

- [Any redeploy (even same version) counts as an update] → correct from the user's view: the running code is outdated either way.
- [Dev mode has no service worker, so the notice/dots never appear locally] → covered by unit tests mocking `virtual:pwa-register/vue`; verify end-to-end with `npm run build && npm run preview` and a second build.
- [The top notice pushes the profile tour targets down] → their popovers already sit `side: 'top'`; the tour is walked with and without a pending update.
- [The release changelog lists only the PR's `feat` entry] → owner accepted; the tooltip fix is described in the PR body only.
- [Version text in tests/dev reads the local `package.json`] → expected.

## Migration Plan

Frontend only; ships with the next release. Rollback = revert the commit.
