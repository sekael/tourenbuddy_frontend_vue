## Why

When a user picks a location via the crosshair and saves a tour, the marker appears offset from the intended position. The crosshair is CSS-centered in the full map container, but `map.getCenter()` returns the center of the _padded_ viewport — and padding persists from prior `flyTo` calls (e.g., viewing a tour info sheet). This causes a geographic offset between what the user sees and what gets saved. Ref: [#63](https://github.com/sekael/tourenbuddy_frontend_flutter/issues/63).

## What Changes

- **Fix coordinate capture in location picker**: Replace `map.getCenter()` with `map.unproject()` using the actual pixel center of the map canvas. This always returns the geographic coordinates at the visual center (where the crosshair renders), regardless of any map padding state.
- **Add regression test**: Unit test confirming the coordinate capture uses pixel-center unprojection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tours`: The location-picking coordinate capture changes from `getCenter()` to pixel-center `unproject()`.

## Impact

- `src/features/map/presentation/components/location-picker.vue` — coordinate capture logic
- No API, schema, or dependency changes
- No breaking changes
