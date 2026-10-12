# Tasks

## 1. Git Setup

- [ ] 1.1 Work continues on `fix/hide-mobile-tooltips` (owner's choice): owner commits the staged merge of `main` (0.43.0) first; verify `git status` is clean apart from this change's files and `git log -1` is the merge commit

## 2. Update state

- [ ] 2.1 `__APP_VERSION__` Vite `define` from `package.json` + `env.d.ts` declaration + Vitest define; optional `VITE_BUILD_COMMIT` in `core/constants/env.ts`; `deploy-preview.yml` Create Env File writes the PR head SHA (D3); verify `npm run type-check`, a unit test for the label (`Version x` / `· 1a2b3c4` / `· dev`) and the env schema test accepting a missing value
- [ ] 2.2 Rework `core/composables/use-pwa-update.ts` into a module singleton with `updateAvailable`, `showBanner`, `apply`, `dismissBanner` (D1), the throttled foreground check skipped offline (D2) and the deferred reload for hidden windows (D2b); update `update-prompt.vue`; verify unit tests: two callers register once, dismissing the banner keeps `updateAvailable`, visible→ `reg.update()` only when online and ≥15 min since last check, hidden `controllerchange` reloads on next visible and not before

## 3. Profile

- [ ] 3.1 `app-update-notice.vue` (first row while pending) and `app-version-line.vue` (bottom, light gray) mounted in `profile-overview.vue`; i18n `user.profile.version` (`en`, `de-CH`) (D4); verify component tests: notice only when pending, button calls `apply` (also while offline), version label rendered

## 4. Speed dial

- [ ] 4.1 Profile menu item `dot` + accessible label `map.overlay.profileUpdateAvailable` (`en`, `de-CH`) and trigger `dot` include `updateAvailable` (D5); verify component tests: pending + no inbox count → trigger and profile dots; pending + count → trigger shows count, profile dot shown; profile item's accessible name includes "update available" only while pending

## 5. Verification

- [ ] 5.1 Walk the guided tour end-to-end twice — without and with a pending update — and confirm the phone, notifications and calendar-sync spotlights stay on screen with the notice present
- [ ] 5.2 `npm run build && npm run preview`, then rebuild with a bumped version: banner appears; after dismissing it the notice and both dots remain; a reload shows the banner again; tapping the notice's button reloads onto the new build; a second tab left in the background reloads when switched to
- [ ] 5.3 `npm run test` and `npm run type-check` pass

## 6. Finalize

- [ ] 6.1 Run `npx eslint src test --fix` from the worktree and verify zero warnings; never `npm run format`
- [ ] 6.2 Prompt owner to commit with a ready-to-copy message, e.g. `feat(pwa): show app version and persistent update action in profile`
- [ ] 6.3 Prompt owner to push and open a PR to `main` titled `feat(pwa): …` (owner choice: one squashed `feat` entry; tooltip fix described in the PR body only)

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
- Update `inbox-availability-release-notes` task 5.1 to reuse `__APP_VERSION__`.
