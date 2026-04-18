## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/desktop-dialog-overlays`

## 2. DialogWindow primitive

- [x] 2.1 Create `src/core/components/dialog-window.vue` with backdrop, centered card, title/aria-label props, close emit, default slot, and fade-scale transition per `specs/dialog-window/spec.md`
- [x] 2.2 Apply design tokens: `--radius-lg`, `--shadow-lg`, `rgba(15, 23, 42, 0.35)` backdrop, `backdrop-filter: blur(2px)`, max-width 560px, max-height 90dvh
- [x] 2.3 Wire backdrop `@click.self` to emit `close`; ensure content clicks don't propagate
- [x] 2.4 Add ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-label` based on props

## 3. AdaptiveOverlay wrapper

- [x] 3.1 Create `src/core/components/adaptive-overlay.vue` rendering `BottomSheet` when `!useIsDesktop()`, `DialogWindow` when `useIsDesktop()`
- [x] 3.2 Forward `title`, `ariaLabel`, `collapsed` props; re-emit `close`; forward default slot

## 4. Migrate existing sheet consumers

- [x] 4.1 Swap `BottomSheet` → `AdaptiveOverlay` in `src/core/components/feedback-sheet.vue`
- [x] 4.2 Swap `BottomSheet` → `AdaptiveOverlay` in `src/features/user/presentation/components/user-profile-sheet.vue`
- [x] 4.3 Swap `BottomSheet` → `AdaptiveOverlay` in `src/features/contacts/presentation/components/contacts-list-sheet.vue`
- [x] 4.4 Verify each still exposes the same slot/emits contract

## 5. Tour creation dialog migration

- [x] 5.1 Refactor `src/features/tours/presentation/components/tour-creation-dialog.vue` to render inside `AdaptiveOverlay` (bottom sheet on mobile, dialog on desktop); remove bespoke `.dialog-backdrop` / `.dialog` styles replaced by the primitive
- [x] 5.2 Preserve existing header ("New Tour"), form, and `pickPoint` emit behavior

## 6. Map page single-overlay policy

- [x] 6.1 Extend `OverlayName` type in `src/features/map/presentation/pages/map-page.vue` to include `'tour-creation'`
- [x] 6.2 Replace `showTourCreationDialog` ref with `computed(() => activeOverlay.value === 'tour-creation')`
- [x] 6.3 Update `handleLocationConfirmed` and related flows to call `openOverlay('tour-creation')` instead of setting the independent ref
- [x] 6.4 Update `handleDialogClose` / `handleTourCreated` to call `closeOverlay()`
- [x] 6.5 Ensure opening any overlay (via `openOverlay`) while tour-creation is active closes tour-creation (resets `pendingLocation` + initial values)

## 7. Container positioning & transition

- [x] 7.1 In `map-page.vue`, update `.sheet-container` so desktop no longer forces bottom anchoring (e.g. `@media (min-width: 600px) { display: contents }`)
- [x] 7.2 Replace or neutralize outer `<Transition name="sheet" mode="out-in">` so each overlay component drives its own enter/leave animation; keep `mode="out-in"` to serialize swaps
- [x] 7.3 Verify `flyToSelectedTour` padding logic still works with adaptive container

## 8. Tests

- [x] 8.1 Add `test/core/components/dialog-window.spec.ts`: renders title, emits close on button + backdrop click, ignores card click, ARIA attrs present
- [x] 8.2 Add `test/core/components/adaptive-overlay.spec.ts`: mocks `useMediaQuery` to verify branching renders `BottomSheet` vs `DialogWindow`
- [x] 8.3 Update/extend `test/features/map/presentation/pages/map-page.spec.ts` (or create) with scenarios: opening feedback closes profile on desktop; opening tour-creation deselects tour on desktop; opening any overlay on mobile still closes previous bottom sheet
- [x] 8.4 Run `npm run test` — all green

## 9. Finalize

- [x] 9.1 Run `npm run lint` and fix warnings
- [x] 9.2 Run `npm run format`
- [x] 9.3 Run `npm run type-check`
- [x] 9.4 Prompt user to commit with message: `feat(map): desktop dialog windows for overlays with unified single-active policy`
- [x] 9.5 Prompt user to push branch and open PR against `main`
