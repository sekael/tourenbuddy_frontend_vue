# Proposal

## Why

Users plan hikes and ski tours in TourenBuddy, but the map shows no official trail network: they cross-check
map.geo.admin.ch to see where the marked hiking trails and Swisstopo ski routes run (issue #324). Showing
both as overlays, and letting users tap a ski route to see where it leads, keeps planning in the app. A tap
returns the route's real line geometry, which is the foundation for a later "draw a track that snaps to
trails" feature.

## What Changes

- New **trail overlays**: Swisstopo hiking trails (`ch.swisstopo.swisstlm3d-wanderwege`) and ski routes
  (`ch.swisstopo-karto.skitouren`) rendered as WMTS raster overlays on either base map, beneath all tour
  markers and GPX tracks. Any combination can be on, and overlays survive a base-map switch.
- The speed-dial entry "Change base map" becomes **"Map layers"**: a panel with a "Base map" section (single
  choice) and an "Overlays" section (independent toggles), both as preview tiles with a clear selected
  state. The entry stays usable offline: only the base-map section is disabled there.
- The overlay selection **persists per device**. The base-map choice stays unpersisted.
- **Ski route lookup**: from zoom 11, with the ski overlay on, tapping near a ski route (thumb-sized
  tolerance) identifies it via the Swisstopo `identify` API. One hit opens its details, several open a
  nearest-first list (max 8). Routes are highlighted, and the map frames them if needed. The card is a bottom
  sheet on mobile and a side drawer on desktop. Zoomed-out taps prompt "zoom in". Hiking trails are
  display-only.
- **Overlay tile caching**: overlay tiles are served cache-first from a dedicated cache (30 days), so they
  are not refetched on every view and stay visible offline once seen.
- **Snapping groundwork**: a framework-free `Trail` entity with normalized line geometry, a pure
  nearest-point-on-polyline function (the core primitive of snapping), and a single overlay registry. No
  drawing or snapping is built in this change.
- Onboarding: the "switching maps" step becomes "map layers" and mentions tapping ski routes.

Out of scope: hiking-trail lookup, offline region downloads of overlays, snowshoe/winter-hiking layers,
drawing/snapping tracks, legends.

## Capabilities

### New Capabilities
- `map-trail-overlays`: Swisstopo trail overlays on the map — available overlays, the map layers panel, draw
  order, per-device persistence, behavior across base-map switches and offline.
- `trail-lookup`: Identifying ski routes under a tap, the candidate list, highlighting and framing, the
  route card, and the trail data model (geometry + attributes) that later drawing/snapping builds on.

### Modified Capabilities
- `map-integration`: "Map style switching" moves into the map layers panel, is disabled offline at section
  level, and keeps overlays on across a switch.
- `onboarding-tour`: the "switching maps" step becomes "map layers" and spotlights the layers panel.
- `pwa-support`: new cache-first runtime rule for trail-overlay tiles in a dedicated cache.

## Impact

- **Code:** `features/map`:
  - new overlay/highlight layer module;
  - map layers panel replacing `map-base-map-panel.vue`;
  - `map-store` overlay + trail-card state;
  - `tourenbuddy-map.vue` style-load re-add + tap payload;
  - `map-page.vue` tap routing + trail card;
  - `frame-tour.ts` generalized to bounds;
  - new trail entity, nearest-point geometry, and Swisstopo `identify` service (Zod-validated).

  Also `features/onboarding` (step + copy), `src/core/components/icons.ts` (`layers`), `src/sw.ts`,
  `public/map-layers/` thumbnails, and `en.json` / `de-CH.json`.
- **External API:** `api3.geo.admin.ch/rest/services/api/MapServer/identify` (public, CORS `*`, no key) and
  `wmts.geo.admin.ch` overlay tiles.
- **DB / Worker:** none.
