## Why

During new tour creation, users pick a goal location, then fill out the creation form. If they realize the pinned location is wrong, they currently have to cancel the whole flow and restart — losing any form values already entered. Issue #69 asks for a "Change" button on the creation form that reopens the location picker, mirroring the behavior already available in tour edit mode.

## What Changes

- Tour creation dialog SHALL render `TourForm` with `allowGoalEdit` set to `true` so the goal row exposes a "Change" button.
- When the user taps "Change" in creation mode, the `LocationPicker` SHALL reopen, centered on the current draft goal, with form values preserved in memory.
- On picker cancel: draft goal, suggested name, and elevation SHALL remain unchanged.
- On picker confirm with the SAME coordinates (within a small epsilon): no update — name and elevation preserved.
- On picker confirm with DIFFERENT coordinates: update draft goal coordinates, refetch auto-suggested name (only if the user has not edited the name manually), and refetch elevation.
- The tour creation dialog/sheet SHALL be suspended (collapsed header, inputs disabled, not dismissible) while the picker is active — same pattern as edit mode.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `tours`: extend creation dialog + shared form requirements so goal is editable during creation via the location picker, with name/elevation refetch on change.

## Impact

- `src/features/tours/presentation/components/tour-creation-dialog.vue` — pass `allowGoalEdit`, handle `pickPoint: 'goal'`, track whether user manually edited name.
- `src/features/map/**` or wherever creation orchestrates the `LocationPicker` — route a new "change goal" request back into picker mode while preserving the in-progress draft.
- Name suggestion service (`features/tours/data/services/name-suggestion`) and elevation service — re-invoked on confirmed goal change.
- Tests under `test/features/tours/presentation/components/` for the creation dialog.
- No backend/schema changes, no new deps.
