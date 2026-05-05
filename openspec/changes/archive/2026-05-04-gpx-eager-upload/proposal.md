## Why

GPX upload only pre-uploads in create mode. In edit mode, upload happens on Save, so users wait silently with no progress feedback. Save button is not visually disabled during upload, so users can attempt submit on incomplete state. Existing-track UI uses verbose text buttons that crowd the row.

## What Changes

- Pre-upload GPX immediately on file pick in **edit mode** as well as create mode.
- Show spinner on filename chip while upload in flight (both modes).
- Disable Save/Submit button visually (greyed out, `:disabled` styling) while upload in flight; Cancel button stays active.
- Cancel during in-flight upload rolls back: aborts/ignores result and removes any uploaded blob from storage.
- When existing tour already has a GPX track, render Replace and Remove as **icon-only buttons** with `title` tooltips (`tours.form.gpxReplaceTooltip`, `tours.form.gpxRemoveTooltip`); keep filename chip visible.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `gpx-display`: Add requirements for eager pre-upload in edit mode, save-button disable-during-upload, cancel rollback, and icon-only replace/remove buttons for existing tracks.

## Impact

- `src/features/tours/presentation/components/tour-form.vue` — eager upload flow extended to edit mode (already exists for create); icon-only existing-track buttons; submit disabled state styling.
- `src/features/tours/presentation/components/tour-info-sheet.vue` — drop on-save GPX upload path; pass `preUploadGpx` and consume pre-uploaded key on submit.
- `src/features/tours/presentation/stores/tours-store.ts` (`updateTour`) — accept pre-uploaded storage key instead of `File` for the eager path.
- Locale files `en.json`, `de-CH.json` — add tooltip keys.
- No DB / API changes.
