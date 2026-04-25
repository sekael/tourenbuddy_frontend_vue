## 1. Git Setup

- [x] 1.1 Fetch and branch: `git fetch origin && git checkout main && git pull && git checkout -b feat/69-change-tour-goal-during-creation`

## 2. Tour form reactivity

- [x] 2.1 In `src/features/tours/presentation/components/tour-form.vue`, add `watch(() => props.initialName, (v) => { if (v != null) name.value = v })` (same for `initialElevation`) so post-mount prop changes propagate into visible fields.
- [x] 2.2 Verify the watcher does NOT fire for `null` updates (preserve user values if Swisstopo returns null).

## 3. Tour creation dialog wiring

- [x] 3.1 In `src/features/tours/presentation/components/tour-creation-dialog.vue`, pass `:allow-goal-edit="true"` to `TourForm`.
- [x] 3.2 Widen the component's `pickPoint` emit to `'start' | 'end' | 'goal'` and forward the `'goal'` case (remove the filter in `handlePickPoint`).
- [x] 3.3 Adjust the picking-title fallback so "Change: <name>" reads naturally when `'goal'` is in play (reuse existing i18n keys where possible; add keys only if missing per `.claude/conventions.md`).

## 4. Map page orchestration

- [x] 4.1 In `src/features/map/presentation/pages/map-page.vue`, widen `handlePickPoint` to accept `'start' | 'end' | 'goal'` and set `pendingPickType` accordingly before flipping `isPickingLocation`.
- [x] 4.2 Extend `handleLocationConfirmed`'s creation branch: when `pendingPickType === 'goal'`, convert both the new `location` and `pendingLocation.value` via `wgs84ToLv95` (from `src/core/utils/wgs84-to-lv95.ts`) and compute euclidean distance in meters. If ≤ 10m, reopen `tour-creation` overlay without lookups. If > 10m, run `Promise.all([getElevation(location), suggestTourName(location)])`, assign to `pendingLocation` / `dialogInitialElevation` / `dialogInitialName`, then reopen overlay. Extract the distance check to a small helper (e.g., `src/features/tours/domain/distance.ts` exporting `isSameGoal(a, b, thresholdMeters = 10)`) so it is unit-testable.
- [x] 4.3 Extend `handleLocationCancelled`'s creation branch to also reopen `tour-creation` when `pendingPickType === 'goal'` (alongside `'start'`/`'end'`).
- [x] 4.4 Reset `pendingPickType` to `'goal'` after handling (matches existing pattern).

## 5. Tests

- [x] 5.1 Add component test for `tour-creation-dialog.vue`: emits `pickPoint: 'goal'` when `TourForm` emits it, renders collapsed state while `isPickingLocation` is true.
- [x] 5.2 Add unit test for `tour-form.vue`: changing `initialName` prop post-mount updates the visible name; null update leaves existing value untouched.
- [x] 5.3 Unit-test `isSameGoal`: returns true for ≤10m LV95 distance (e.g., 9.9m), false for >10m (e.g., 10.1m), verified across a Swiss reference coordinate.
- [x] 5.4 Add test for `map-page.vue` goal-change flow: same-goal path does not call elevation/name services; different-goal path does and updates `pendingLocation` / `dialogInitialElevation` / `dialogInitialName`.

## 6. i18n

- [x] 6.1 Add/verify i18n keys for the goal "Change" label in both `src/app/i18n/locales/en.json` and `de-CH.json`. Reuse existing keys if they already exist from edit mode.

## 7. Finalize

- [x] 7.1 Run `npx eslint . --fix`.
- [x] 7.2 Run `npm run format`.
- [x] 7.3 Run `npm run type-check`.
- [x] 7.4 Run `npm run test` — all pass.
- [x] 7.5 Manually verify in dev: create new tour, change goal, cancel → values preserved; change goal, confirm same → no change; change goal, confirm new → coords/name/elevation updated; other form fields (partners/date/type/notes) preserved across all paths.
- [x] 7.6 Prompt user to commit with message: `feat(tours): allow changing goal location during tour creation\n\nCloses #69`.
- [x] 7.7 Prompt user to push branch and open PR against `main`.
