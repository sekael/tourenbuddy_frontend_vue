## Why

Currently every tour renders as the same orange-red circle on the map, so users cannot visually distinguish winter sports from summer activities or paragliding at a glance. Color-coded markers by tour type (GitHub issue #13) make the map scannable and let users spot seasonally relevant tours instantly.

## What Changes

- Add color groups for tour types: winter sports (blue), summer sports (red), paragliding (amber), unknown/null (grey).
- Replace the static circle color in the MapLibre tour marker layers with a data-driven `match` expression keyed on `tourType`.
- Add `tourType` to the GeoJSON feature properties emitted by the tour-to-feature converter.
- Change the edit-mode preview marker: instead of a fixed orange circle, show a lighter variant of the selected tour's type color (mirrors the current red→orange "tentative" relationship).
- Export `TOUR_TYPE_COLORS` and `TOUR_TYPE_PREVIEW_COLORS` records from the tour-type model so other UI surfaces (chips, icons) can reuse the palette in the future.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `map-integration`: "Tour markers rendered as circles" requirement is extended — marker color is no longer static; it is derived from the tour's `tourType`. Edit-mode preview marker color is derived from the same mapping using a lighter variant.

## Impact

- **Code**:
  - `src/features/tours/data/models/tour-type.ts` — new color constants.
  - `src/features/tours/domain/entities/tour.ts` — add `tourType` to feature properties.
  - `src/features/map/presentation/components/tours-marker-layer.ts` — data-driven paint expressions; `updatePreview` signature change.
  - `src/features/map/presentation/components/tourenbuddy-map.vue` — pass selected tour's type into `updatePreview`.
- **Dependencies**: none. Uses existing MapLibre `match` expression support.
- **Tests**: no existing assertions on marker colors; may add unit coverage for the expression builder / color lookup.
- **Visual**: all tour markers will change color on next deploy. No data migration.
