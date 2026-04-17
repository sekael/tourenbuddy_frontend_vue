## Why

Users currently have no way to distinguish tours they have already done from ones still on their wishlist. Tracking completion on each tour turns the map into a record of personal history and keeps upcoming tours visually distinct from done ones. Resolves [issue #17](https://github.com/sekael/tourenbuddy_frontend_vue/issues/17).

## What Changes

- Add a persisted `completed` boolean field on the tour entity, Zod schema, Supabase row, and repository contract (default `false`).
- Extend tour repository with an update path for the completion flag (new or reused update method).
- Tour info sheet/drawer gains a toggle control (e.g. checkbox/button) to mark a tour completed or revert to not-completed. State updates optimistically through the tours store.
- Map marker renderer shows a visually distinct style for completed tours: a check glyph inside the colored circle if MapLibre symbol layering allows, otherwise a muted/desaturated variant of the tour-type color.
- Marker layer updates reactively the moment a tour’s `completed` state changes — no page reload.

## Capabilities

### New Capabilities

- `tour-completion`: persistence, UI toggle, and map rendering for completed vs. not-completed tour state.

### Modified Capabilities

- `tour-extended-model`: add `completed` field to the tour data model.
- `tour-info-extended`: info sheet gains the completion toggle.
- `map-integration`: marker layer reflects completion state.

## Impact

- DB: new column on `tours` table (Supabase migration) with default `false`.
- Models: `src/features/tours/data/models/` Zod schema + inferred types.
- Domain: tour entity gains `completed`.
- Repository: interface + Supabase impl update method.
- Store: `tours` Pinia store exposes `setCompleted(tourId, value)` action.
- UI: tour info sheet component adds toggle; map marker GeoJSON feature carries `completed` property; MapLibre style layer adjusted.
- Tests: unit tests for store action, repository mapping, and marker style selection.
