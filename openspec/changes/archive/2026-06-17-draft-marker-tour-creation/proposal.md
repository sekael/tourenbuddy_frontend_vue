## Why

When editing an existing tour's goal, the map already shows a lighter-tone "draft" preview marker so the user sees where the goal will land before saving. Tour **creation** has no such feedback — the user picks a goal, fills the form, and only sees a marker after the tour is saved. This is inconsistent and gives no spatial confirmation during creation.

**Scope note:** this is a desktop-focused UX improvement. On mobile the creation form is a full-screen page, so the draft marker is visible only while re-picking the goal (form collapsed) and after save; the live recolor is not visible on mobile. That is accepted — no extra mobile work.

## What Changes

- During tour creation, a tentative draft marker SHALL appear on the map at the picked goal as soon as the goal is chosen, using the same lighter-tone preview style as edit mode.
- Re-picking the goal during creation SHALL move the single existing draft marker rather than adding another.
- The draft marker SHALL use the neutral-light fallback color until the user selects an activity type in the creation form, then SHALL live-update to that type's lighter shade.
- On save, the draft marker SHALL remain on screen through the create round-trip and SHALL be cleared only once the real, activity-type-colored marker exists in the store, so the light draft visibly transforms into the saved marker (no empty-map gap during create latency).
- The draft marker SHALL be cleared if creation is cancelled.

## Capabilities

### New Capabilities

(none — extends existing map-integration behavior)

### Modified Capabilities

- `map-integration`: the "Edit-mode preview marker" requirement is generalized to cover the tour-creation flow (draft marker appears/moves/recolors during creation, transforms to the real marker on save). Camera centering is unchanged — the existing `bottom: sheetHeight` fly-to already centers the marker in the remaining map space on open and intentionally leaves the camera static while the sheet is dragged.

## Impact

- `src/features/map/presentation/stores/map-store.ts` — preview-goal state may be generalized/renamed to serve creation as well as edit.
- `src/features/map/presentation/pages/map-page.vue` — wire the preview goal + live tour type during creation.
- `src/features/map/presentation/components/tourenbuddy-map.vue` — feed the creation-time tour type into `updatePreview`.
- `src/features/tours/presentation/components/tour-creation-dialog.vue` / `tour-form.vue` — surface the live-selected activity type for the preview color.
- No DB/schema, API, or dependency changes.
