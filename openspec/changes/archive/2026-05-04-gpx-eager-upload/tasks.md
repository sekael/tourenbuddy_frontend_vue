## 1. Git Setup

- [x] 1.1 Already on branch `feat/61-gpx-track-storage` (continuation of GPX work). Confirm with user; otherwise create `feat/<n>-gpx-eager-upload` from latest `main`.

## 2. Tour form: unify eager-upload path

- [x] 2.1 In `tour-form.vue`, remove the `preUploadGpx` prop branch — make eager pre-upload the only path for `handleGpxUpload`.
- [x] 2.2 Update `handleSubmit` to always emit `effectiveGpxFilepath = pendingGpxKey ?? gpxFilepath` and never emit a `File`. Drop `gpxFile` and `fileToUpload` from the submit payload (or keep payload shape for compatibility but always pass `null` for the file).
- [x] 2.3 Update `handleCancel` and `handleRemoveGpx` to always run the rollback path (delete `pendingGpxKey` if present, set `wasCancelledDuringUpload` if in flight).
- [x] 2.4 Add CSS for `.submit-btn:disabled` — `opacity: 0.5; cursor: not-allowed; transform: none;` and disable hover effects.

## 3. Tour form: icon-only existing-track buttons

- [x] 3.1 Replace text in Replace and Remove buttons inside `.gpx-filled-row` with icon-only markup; add `:title` and `:aria-label` bound to new locale keys.
- [x] 3.2 Add CSS tweak so `.gpx-action-btn` without a label is square (e.g. `min-width: 44px; padding: var(--spacing-xs)`).

## 4. Tour info sheet: switch edit-mode to eager upload

- [x] 4.1 In `tour-info-sheet.vue`, pass `:pre-upload-gpx="true"` to `<TourForm>` (or remove the prop entirely once 2.1 is done).
- [x] 4.2 Update `handleEditSubmit` signature to accept `(draft, gpxFilepath, gpxRemoved, preUploadedTourId)` matching create flow; drop the `gpxFile` upload-on-save branch and `isGpxSaving` state.
- [x] 4.3 Remove `:gpx-uploading="isGpxSaving"` prop binding (now redundant — form owns the spinner state).

## 5. Tours store

- [x] 5.1 Update `toursStore.updateTour` signature: replace `gpxFile: File | null` parameter with `gpxFilepath: string | null` (the pre-uploaded key) and continue accepting `gpxRemoved: boolean`. Internal `uploadGpx` call inside `updateTour` is removed.
- [x] 5.2 Verify call sites — only `tour-info-sheet.vue` calls `updateTour`. Update to new signature.

## 6. i18n

- [x] 6.1 Add keys `tours.form.gpxReplaceTooltip` and `tours.form.gpxRemoveTooltip` to `en.json` and `de-CH.json`.

## 7. Tests

- [x] 7.1 Update existing `tour-form` tests for new submit emit shape (no `File`).
- [x] 7.2 Add edge-case tests: cancel during in-flight upload deletes blob; replace deletes superseded blob; submit-btn `:disabled` reflects `isUploadingGpx`.
- [x] 7.3 Update `tour-info-sheet` tests for new `updateTour` signature and removal of `isGpxSaving`.

## 8. Manual verification

- [x] 8.1 `npm run dev`. Create tour → pick GPX → spinner shows, Save greyed → upload completes → Save enables → submit persists.
- [x] 8.2 Edit tour → pick GPX → same eager behavior. Cancel mid-upload → confirm orphan blob removed (check storage browser).
- [x] 8.3 Open tour with existing track → Replace and Remove appear as icon-only with hover tooltip.

## 9. Finalize

- [x] 9.1 `npx eslint . --fix` then `npm run format` then `npm run type-check` then `npm run test` — all clean.
- [x] 9.2 Prompt user to commit with message: `feat(tours): eager GPX pre-upload in edit mode + icon-only replace/remove`.
- [x] 9.3 Prompt user to push branch and open PR.
- [x] 9.4 After merge, prompt user to run `/opsx:archive gpx-eager-upload`.
