# Proposal

## Why

When a tap on the map finds several ski routes, the trail card lists them. Choosing one opens its details and highlights it, but the camera only moves if part of the route is hidden. A route that is already somewhere in view stays a small line in a corner, and a short route is never zoomed into. The user picked that route to look at it, so the map should show it.

## What Changes

- Choosing a route from the multi-route list SHALL always frame that route in the map area left beside the sheet (mobile) or side drawer (desktop): centred there and zoomed in or out so the whole line fills that area with a small margin and nothing cut off.
- Framing a chosen route may zoom in further than tour framing (cap raised from zoom 12 to 15), so short routes fill the space.
- Unchanged: the list view and a single-route lookup still move the camera only when the highlighted geometry is not fully visible. Going back from details to the list does not move the camera unless the candidates are hidden.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `trail-lookup`: "Trail card placement and framing" gains the always-frame rule for a route chosen from the list.

## Impact

- `src/features/map/presentation/composables/frame-tour.ts` (`frameBounds` takes an optional max zoom)
- `src/features/map/presentation/pages/map-page.vue` (trail framing watcher)
- Tests under `test/features/map/`
