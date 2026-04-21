## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b fix/66-stale-location-picker`

## 2. Core: SideDrawer + BottomSheet collapsed mode

- [x] 2.1 Add `collapsed?: boolean` prop to `src/core/components/bottom-sheet.vue`; when true, hide default slot, hide close button, hide drag handle, suppress backdrop click handler, suppress Escape key handler, shrink container to title-only height
- [x] 2.2 Add `collapsed?: boolean` prop to `src/core/components/side-drawer.vue`; on desktop render as compact top-right header with title only; pass-through `collapsed` to `BottomSheet` on mobile fallback
- [x] 2.3 Ensure slot content stays mounted across `collapsed` toggle so child component state (TourForm inputs) is preserved
- [x] 2.4 Add component tests in `test/core/components/` for `collapsed` behavior of both components (slot hidden, close/drag/backdrop suppressed, slot state preserved via parent keepalive test)

## 3. Core: TourForm disabled prop

- [x] 3.1 Add `disabled?: boolean` prop to `src/features/tours/presentation/components/tour-form.vue`
- [x] 3.2 Wrap form body (inputs + non-picker action buttons) in `<fieldset :disabled="disabled">`; keep pick-point trigger buttons visible but disabled while `disabled` is true
- [x] 3.3 Add/extend component test in `test/features/tours/presentation/components/tour-form.spec.ts` to verify inputs and non-picker buttons are disabled when `disabled` is true, and submit does not emit

## 4. TourInfoSheet: collapse + submit guard

- [x] 4.1 In `src/features/tours/presentation/components/tour-info-sheet.vue`, import `useMapStore`, expose a computed `isPicking = computed(() => mapStore.isPickingLocation)`
- [x] 4.2 Compute `sheetCollapsed = computed(() => isPicking.value && mode.value === 'edit')` and bind it to `SideDrawer`/`BottomSheet` (`:collapsed="sheetCollapsed"`), replacing the existing mobile-only partial collapse logic
- [x] 4.3 Build collapsed header title from `t('tours.infoSheet.editTitle', { name: tour.name })` — add missing i18n keys to `en.json` and `de-CH.json`
- [x] 4.4 Pass `:disabled="isPicking"` to the `TourForm` child
- [x] 4.5 In `handleEditSubmit`, early-return if `mapStore.isPickingLocation` is true; log via `useLogger` at debug level
- [x] 4.6 Ensure picker confirm/cancel flow still applies `editPickedPoint` to the form and does not require any extra teardown on the sheet
- [x] 4.7 Add/extend test in `test/features/tours/presentation/components/tour-info-sheet.spec.ts`: while `isPickingLocation` is true, sheet is collapsed, form disabled prop is true, and `handleEditSubmit` does not call `toursStore.updateTour`

## 5. TourCreationDialog parity

- [x] 5.1 Apply the same collapse + disabled-form + submit-guard treatment to the create flow container (`tour-creation-dialog` or its wrapper) so re-picking start/end from within create is consistent
- [x] 5.2 Add/extend tests covering the create flow suspension

## 6. Spec verification

- [x] 6.1 Manual QA on desktop (Brave) per issue steps: edit existing tour → pick Start Point → verify form collapses to "Edit: <tour title>" in top-right, inputs disabled, Escape/backdrop do not dismiss; confirm picker → form reopens with new coordinates; save persists correctly
- [x] 6.2 Manual QA on mobile viewport: edit tour → pick Goal → verify sheet collapsed to title-only, no close button, no backdrop-click-close; cancel picker → sheet re-expands with unchanged goal
- [x] 6.3 Manual QA start + end + goal all behave identically; create-flow re-pick also suspends the creation dialog
- [x] 6.4 Regression check: single-pick add flow still works (no tour edit sheet open during initial pick)

## 7. Finalize

- [x] 7.1 Run `npx eslint . --fix`
- [x] 7.2 Run `npm run format`
- [x] 7.3 Run `npm run type-check`
- [x] 7.4 Run `npm run test` — all must pass
- [x] 7.5 Prompt user to commit with message:

  ```
  fix(tours): prevent stale location picker during tour edit

  Suspend tour edit surface (collapse side drawer / bottom sheet to
  title-only header, disable form inputs, suppress dismissal) while
  location picker is active for goal, start, and end points. Guard
  handleEditSubmit and creation-dialog submit against picking state.

  Closes #66
  ```

- [x] 7.6 Prompt user to push branch and open PR against `main`
