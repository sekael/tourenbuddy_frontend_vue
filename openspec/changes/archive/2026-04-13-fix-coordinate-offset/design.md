## Context

The location picker overlays a CSS-centered crosshair on the map and reads the map center via `map.getCenter()` on confirm. MapLibre's `getCenter()` returns the center of the **padded** viewport. Padding persists after `flyTo({ padding })` calls — used when viewing tour info sheets (bottom padding on mobile, right padding on desktop). This mismatch between visual crosshair center and logical map center causes saved coordinates to be offset from where the user aimed.

Current code (`location-picker.vue:17`):

```ts
const center = props.map.getCenter()
```

## Goals / Non-Goals

**Goals:**

- Saved coordinates match the visual crosshair position exactly, regardless of map padding state
- Zero regression on existing tour display, creation flow, or map interactions

**Non-Goals:**

- Resetting or managing map padding lifecycle (separate concern)
- Changing how `flyTo` applies padding for tour viewing
- Modifying the crosshair visual positioning

## Decisions

### Use `map.unproject()` with pixel center instead of `map.getCenter()`

**Choice**: Extract a named helper `getCrosshairCoordinates(map)` that uses `map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2])` instead of `map.getCenter()`.

**Rationale**: `unproject()` converts a pixel coordinate to geographic coordinates. Using the actual pixel center of the canvas always matches where the CSS-centered crosshair renders, regardless of any padding state. Wrapping this in a descriptively named function makes the intent self-documenting — `getCenter()` reads like it should be correct, but `getCrosshairCoordinates()` makes it clear we're reading the position under the visual crosshair, not the logical map center.

**Alternative considered — reset padding before reading center**: Would require `map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 })` which triggers a re-render and could cause visual flicker. Also fragile if padding management changes later.

**Alternative considered — reset padding on entering pick mode**: More invasive, and the camera would jump when entering pick mode if padding was active.

## Risks / Trade-offs

- **[Low] `clientWidth`/`clientHeight` vs `width`/`height`**: `clientWidth` excludes borders/scrollbars, which is correct for the map canvas. No risk since the canvas has no borders or scrollbars.
- **[None] API stability**: `map.unproject()` is a core MapLibre API, stable across versions.
