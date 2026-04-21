## Why

Bug [#66](https://github.com/sekael/tourenbuddy_frontend_vue/issues/66): when editing a tour and invoking the location picker for start/end/goal, the tour edit form stays interactive. Users can change form fields and save the tour while the picker is still open — afterwards the picker's Cancel/Confirm buttons target stale edit state and silently no-op. This leads to lost picks and confusing UX on both desktop and mobile.

## What Changes

- Treat an active location picker as a modal state that suspends the tour edit form.
- Collapse the tour edit surface to a title-only header while picking:
  - Desktop (`side-drawer`): shrink to a header bar showing "Edit: <tour title>" in the top-right corner.
  - Mobile (`bottom-sheet`): collapse to title-only; disable backdrop-click-to-close and hide the close button.
- Disable all form inputs and non-picker action buttons in `tour-form` via a `disabled` prop (wrapped `fieldset`).
- Restore the edit surface with the newly picked coordinates when the picker is confirmed; restore with the prior value on cancel.
- Guard `handleEditSubmit` so it refuses to run while picking (defense in depth).
- Apply the same coordination for the create-tour flow where the picker overlays a creation dialog, so behavior is consistent for add and edit.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `map-integration`: location-picker requirements extend to describe its modal relationship with any open tour edit/create surface, including suspension of competing UI while picking.
- `tours`: tour edit flow requirements describe collapsed-header presentation and disabled form while the picker is active, extend the existing goal-picker requirement to cover start/end points, and add the submit guard.
- `side-drawer`: requirements extend to expose a collapsed header-only presentation mode on both the desktop drawer and its mobile BottomSheet fallback, including suppression of backdrop-click dismissal and the close button while collapsed.

## Impact

- Code:
  - `src/features/map/presentation/pages/map-page.vue` — orchestration of picker + sheet/drawer collapse
  - `src/features/map/presentation/components/location-picker.vue` — no behavior change, possibly emits unchanged
  - `src/features/map/presentation/stores/map-store.ts` — `isPickingLocation` already present; may expose picker target (`startPoint` | `endPoint` | `goal`) if not already
  - `src/features/tours/presentation/components/tour-info-sheet.vue` — drive collapsed state + submit guard
  - `src/features/tours/presentation/components/tour-form.vue` — accept `disabled` prop; `fieldset` wrapping
  - `src/core/components/bottom-sheet.vue` — add `collapsed` mode (header-only, no backdrop-close, no close button)
  - `src/core/components/side-drawer.vue` — add `collapsed` mode (header-only top-right)
- Tests: component tests for sheet/drawer collapsed mode, tour-form disabled prop, tour-info-sheet behavior while `isPickingLocation` is true.
- No API, schema, or dependency changes.
