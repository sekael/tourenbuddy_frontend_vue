## Why

Today only a tour's goal marker appears on the map. When a user opens a tour's details (info sheet), they can read the start- and end-point coordinates as text but cannot see where those points sit relative to the goal and to each other. Showing start/end markers while viewing a tour's details gives spatial context for planning, without polluting the default map or the clustering that powers it. (GitHub #223)

## What Changes

- Add **start** and **end** point markers, rendered **only while a tour's details (info sheet) are open** — for the user's own tours and for partner friend tours alike.
- Start/end markers reuse the goal marker's circle design and tour-type color, distinguished by a centered white icon: **`home`** for start, **`flag`** for end — matching the icons the info sheet already uses for those points.
- Markers are **display-only** (non-interactive); the goal marker remains the only selectable handle.
- Start/end markers **do not participate in clustering** and are **absent from the standard map** — clustering, collision, and the default map view stay goal-only.
- Round-trip / one-way handling mirrors the info sheet: the **start** marker shows whenever `startPoint` is set; the **end** marker shows only when a **distinct** `endPoint` exists (no end marker for round trips where end equals start, nor for one-way-to-goal tours with no end point).
- Extend the existing goal-only **draft preview** mechanism to start and end: in create/edit mode all set points render with their icons, a changed start/end location shows as a lighter-tone draft marker (same behavior already in place for the goal), and saving promotes drafts to saved markers while cancel/unchanged locations leave markers untouched.
- The **completion** check glyph stays on the goal marker only; start/end markers are unaffected by completion state.

## Capabilities

### New Capabilities
<!-- none — this extends existing map marker rendering -->

### Modified Capabilities
- `map-integration`: Tour marker rendering gains start/end detail markers shown only while a tour's info sheet is open, and the edit/create draft-preview mechanism extends from goal-only to goal + start + end.

## Impact

- `src/features/map/presentation/components/tours-marker-layer.ts` — new selection-scoped `tour-detail` GeoJSON source with a circle layer + a symbol layer (white `home`/`flag` glyphs authored like the existing check/friend/link icons), inserted below the goal layers; plus adding the detail circle to the background-click hit-test so taps are swallowed.
- `src/features/map/presentation/stores/map-store.ts` — preview state extends from a single goal to goal/start/end draft points.
- `src/features/map/presentation/components/tourenbuddy-map.vue` — wire the selected tour's start/end into the marker layer and propagate the extended draft preview.
- `src/features/map/presentation/pages/map-page.vue` and `tour-form.vue` — drive start/end draft previews during create/edit alongside the existing goal draft.
- No DB/schema changes — `Tour` already carries `startPoint`/`endPoint` (+ name/elevation).
- i18n: reuse existing `home`/`flag` icons; no new user-facing strings expected.
