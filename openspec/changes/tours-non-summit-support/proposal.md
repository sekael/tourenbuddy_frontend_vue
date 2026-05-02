## Why

Tour planning UX assumes summit tours: form pre-fills end point = start point and labels are summit-flavored. Non-summit tours (one-way hikes, traverses, ski tours ending elsewhere) need explicit support so users can pick a goal and a single start, with end optional. Goal picker also lacks a header explaining what is being picked, leaving the user without context once the form collapses behind the crosshair.

## What Changes

- While picking, the existing collapsed overlay header (mobile bottom sheet / desktop side-drawer compact header) labels what is being picked: "Tour Goal" / "Start Point" / "End Point" (and German equivalents). `location-picker.vue` is not modified.
- Tour creation form (`tour-form.vue`) renders only the start-point row by default; end-point row appears via an "Add end point" affordance.
- **BREAKING (UX):** drop `effectiveStartPoint` / `effectiveEndPoint` fallbacks. Drafts persist `startPoint` and `endPoint` as picked; unset end point stays `null` (one-way tour from start to goal).
- Start and end point picks fetch Swisstopo elevation + name suggestion in parallel (same flow as goal pick) and display them in the form row and tour info sheet.
- Tour entity / Zod schema: add `startPointName`, `startPointElevation`, `endPointName`, `endPointElevation` (all nullable).
- Tour info sheet shows start/end name and elevation when available.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `tours`: Tour model gains nullable name + elevation fields for start and end points; repository persists and returns them.
- `tour-form-extended`: form renders end point conditionally; no auto-fill of end = start; start/end rows display fetched name + elevation; goal picker shows title bar.
- `tour-info-extended`: info sheet renders start/end name + elevation when present.

## Impact

- `src/features/map/presentation/components/location-picker.vue` — title bar slot/prop driven by pick type.
- `src/features/map/presentation/pages/map-page.vue` — invoke `getElevation` + `suggestTourName` on `start`/`end` picks; thread results to form.
- `src/features/tours/presentation/components/tour-form.vue` — remove `effectiveStartPoint/EndPoint`, add "Add end point" toggle, render fetched name/elevation per row.
- `src/features/tours/presentation/components/tour-creation-dialog.vue` — pass new props through.
- `src/features/tours/presentation/components/tour-info-sheet.vue` — show start/end name + elevation.
- `src/features/tours/data/models/tour-schema.ts`, `domain/entities/tour.ts`, `data/repositories/tours-repository-impl.ts` — new fields.
- Supabase: `tours_view`, `tours` table, `create_tour_full` / `update_tour_full` RPCs need new columns + params (DB migration outside repo).
- Locale files: `src/locales/en.json`, `src/locales/de-CH.json`.
- Tests under `test/features/tours/`.
