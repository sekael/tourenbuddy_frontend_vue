## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b fix/35-overlapping-bottom-sheets`

## 2. Refactor MapPage overlay state

- [x] 2.1 Replace `showFeedbackSheet`, `showProfileSheet`, `showContactDialog` refs in `src/features/map/presentation/pages/map-page.vue` with a single `activeOverlay: Ref<'feedback' | 'profile' | 'contacts' | 'tour' | null>` ref
- [x] 2.2 Add `openOverlay(name)` and `closeOverlay()` helpers per `design.md` (clear `selectedTour` + `editPreviewGoal` when switching away from `'tour'`)
- [x] 2.3 Add computed booleans (`showFeedbackSheet`, `showProfileSheet`, `showContactDialog`, `showTourOverlay`) so the template `v-if` conditions stay readable
- [x] 2.4 Wire `MapActionOverlay` `@open-feedback`, `@open-profile`, `@open-contacts` events to `openOverlay('feedback' | 'profile' | 'contacts')`
- [x] 2.5 Wire each sheet's `@close` event to `closeOverlay()`
- [x] 2.6 In `handleTourClicked`, call `mapStore.selectTour(id)` then `openOverlay('tour')`
- [x] 2.7 Add `watch(selectedTourId)` that syncs `activeOverlay` ↔ tour selection (becomes `'tour'` when set, becomes `null` only when currently `'tour'`)
- [x] 2.8 Update `handleMapBackgroundClick` to call `closeOverlay()` instead of toggling individual flags

## 3. Tests

- [x] 3.1 Add or extend `test/features/map/presentation/pages/map-page.test.ts` with cases covering: opening feedback while contacts is open closes contacts; clicking a tour marker while feedback is open closes feedback; opening feedback while a tour is selected clears the tour selection; map-background-click closes whichever overlay is active
- [x] 3.2 Run `npm run test` and confirm new and existing tests pass

## 4. Manual verification

- [x] 4.1 Run `npm run dev` and verify on a desktop viewport (≥600px): open feedback → click a tour marker → only the side drawer is visible; open contacts → open feedback → only feedback is visible
- [x] 4.2 Verify on a mobile viewport (<600px) the same scenarios produce a single bottom sheet at any time
- [x] 4.3 Verify map-background-click closes whichever overlay is active and clears tour selection when applicable

## 5. Finalize

- [x] 5.1 Run `npm run lint` and fix any warnings (zero warnings required)
- [x] 5.2 Run `npm run format`
- [x] 5.3 Run `npm run type-check`
- [x] 5.4 Prompt the user to commit with a ready-to-copy conventional commit message: `fix(map): enforce single open bottom sheet at a time (#35)`
- [x] 5.5 Prompt the user to push the branch and open a PR linking issue #35
