# Design

## Context

`map-page.vue` watches `trailCard.candidates` + `trailCard.selectedId`. On each change it waits for the sheet to settle, builds the bounds of the highlighted geometry (all candidates, or the chosen route) and calls `frameBounds` only when `isBoundsVisible` says some corner lies outside the free map area. `frameBounds` uses `map.cameraForBounds` with padding = margin + covered area (sheet inset or drawer width) and `maxZoom: TOUR_ZOOM` (12).

## Decisions

### Detect "chosen from the list" in the existing watcher

A row pick is the only path where `selectedId` changes from `null` to an id while `candidates` keeps the same array reference (`selectTrail` spreads the card; `showTrails` builds a new candidates array). The watcher already receives old and new values, so it can tell the cases apart without new store state: a pick skips the visibility check. A single-route lookup sets candidates and `selectedId` together (new array) and keeps the "only if hidden" rule from the spec.

Alternative: a `pickedFromList` flag in the store. Rejected: extra state for something the watcher already sees.

### Reuse `frameBounds`, add an optional `maxZoom`

`cameraForBounds` with per-call padding already centres the bounds in the padded area and picks the largest zoom at which everything fits, which is exactly "fill the remaining space without cutting off". Only the cap changes: `frameBounds(map, bounds, covered, fallbackCenter?, maxZoom = TOUR_ZOOM)` and the pick passes `ROUTE_ZOOM = 15`. At zoom 15 a phone-width map shows about 1 km, so even short routes fill the space while a degenerate (near point-sized) geometry does not dive to street level. Both trail overlays serve tiles beyond 15 (max 17/18).

## Risks / Trade-offs

- Sheet height changes between list and details on mobile: the watcher already waits two animation frames before reading `sheetInset`, the same as today's details framing.
- A pick on a very long route zooms out; that is intended (nothing cut off).
