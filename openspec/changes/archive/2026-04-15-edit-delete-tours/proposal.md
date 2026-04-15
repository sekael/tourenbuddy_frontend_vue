## Why

Users can create tours but cannot modify or remove them once saved. Issue #66 requires edit and delete actions on the tour info sheet, matching the interaction model already shipped for contacts so the app feels consistent.

## What Changes

- Add edit mode to the tour info sheet: entry button swaps read-only details for an editable form covering every tour field (name, planned date, type, elevation, GPX, description, seasons, goal, start/end points, equipment, notes, partners). Back button returns to read-only view.
- Goal is editable via the existing location-picker flow: tapping the goal row in edit mode temporarily hides the sheet, shows the crosshair `LocationPicker`, then returns to edit mode with the new coordinates on confirm — or the unchanged coordinates on cancel.
- Add delete button on the tour info sheet with inline confirmation (Delete/Cancel), loading + error states. On confirm, the tour is removed and the sheet closes.
- Extend `ToursRepository` with `updateTour(id, draft)` and `deleteTour(id)`; add matching Supabase RPC `update_tour_full` and a DELETE call against `tours`.
- Extend `useToursStore` with `updateTour` and `deleteTour` actions that mutate the local `tours` array without a full reload.
- Extract the tour form fields from `tour-creation-dialog.vue` into a shared form component (or `tour-detail-view.vue`) so create and edit share validation, partner selection, GPX upload, and point picking.
- Name remains required in edit mode; empty-name save is rejected with inline error.

## Capabilities

### New Capabilities

(none — all work extends the existing `tours` spec)

### Modified Capabilities

- `tours`: add requirements for tour update + delete at repository, store, and UI layers; modify the tour info sheet requirement to include edit/delete entry points; add requirement for a shared tour form used by create and edit flows.

## Impact

- Code:
  - `src/features/tours/domain/repositories/tours-repository.ts` — add `updateTour`, `deleteTour`
  - `src/features/tours/data/repositories/tours-repository-impl.ts` — implement via RPC + DELETE
  - `src/features/tours/presentation/stores/tours-store.ts` — add `updateTour`, `deleteTour` actions
  - `src/features/tours/presentation/components/tour-info-sheet.vue` — add edit/delete UI + mode switch
  - `src/features/tours/presentation/components/tour-creation-dialog.vue` — refactor to use shared form
  - new `src/features/tours/presentation/components/tour-form.vue` (or `tour-detail-view.vue`)
- Backend: new Supabase RPC `update_tour_full` (mirroring `create_tour_full`); DELETE on `tours` relies on RLS + cascade for `tour_partners`.
- Tests: unit tests for store update/delete; component tests for edit/delete UI + validation.
- No breaking changes to existing tour creation flow.
