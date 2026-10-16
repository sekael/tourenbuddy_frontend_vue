# Proposal

## Why

Clickable ski routes (#324) come from the GeoAdmin `identify` API, one request per settled viewport. That
caps them at zoom 12+: a viewport costs ≈350 KB at z12 and ≈660 KB at z11 (uncompressed, all four
languages, max 201 routes), growing ~4× per level out, and every pan outside the loaded area pays again
(issue #326). Serving our own copy of the dataset lets routes be marked and tapped from much further out,
at a fraction of the traffic, and keeps working regardless of how often the app itself is released.

Licensing allows it: the dataset's STAC license link is swisstopo's free-geodata terms (use, distribution,
processing and commercial use allowed; source attribution `©swisstopo` mandatory). Every route with route
information is `source = swisstopo_sac` (2,941 of 10,789 lines); the third-party lines (DAV/ÖAV/AVS, Petzl
Foundation / Skitourenguru, topo.verlag) carry no route information and are not copied.

## What Changes

- **Self-hosted ski-route dataset**: a scheduled GitHub Action checks Swisstopo's STAC collection weekly,
  and on a new release builds vector tiles (z11–z13, overzoomed beyond) plus one full-geometry file per
  route from the official GeoPackage, keeping only routes with route information. It deploys them to a
  separate Cloudflare Pages project, decoupled from app releases, under a versioned path announced by a
  stable TileJSON. The workflow keeps itself enabled despite GitHub's 60-day inactivity rule.
- **Marking from a vector source**: halo and difficulty badges from zoom 11, rendered by MapLibre
  straight from the tiles. The per-viewport `identify` load, its loaded-extent bookkeeping and its request
  per pan are removed. Below zoom 11 the unchanged WMTS raster keeps drawing every route.
- **Taps from zoom 11**, resolved against the rendered routes (no request per pan; one small request per
  tapped route for its full geometry). Highlight, framing and the card always use the route's complete,
  continuous geometry, never tile fragments.
- **BREAKING (UX)**: the "Zoom in to see route details" snackbar is removed. Below zoom 11 a tap behaves as
  with no overlay on.
- **Offline**: ski-route tiles join the offline-region download, so routes and badges show offline in
  downloaded regions. Per-route files and taps stay online-only (deliberate: a GPX track covers offline
  route needs).
- **Caching**: TileJSON network-first, tiles and route files cache-first in a dedicated cache.

Out of scope: hiking-trail data, offline taps / per-route files in region downloads, snapping, replacing the
WMTS ski raster (it still draws the full network including routes without information).

## Capabilities

### New Capabilities
- `ski-route-dataset`: the self-hosted copy of the Swisstopo ski-route dataset — what it contains, how it
  is refreshed and published, versioning, and attribution.

### Modified Capabilities
- `trail-lookup`: marking and taps from zoom 11, zoom-in snackbar removed,
  routes visible offline in downloaded regions, failure handling for the route fetch, complete geometry
  never built from tile fragments.
- `offline-map`: region downloads include ski-route tiles, served offline-first.
- `pwa-support`: runtime caching rules for the ski-route TileJSON, tiles and route files.

## Impact

- **Code:** `features/map`:
  - `trail-layers.ts`: the clickable GeoJSON source becomes a vector source;
  - `use-trail-lookup.ts`: rendered-feature query, dedupe and ranking, then route fetch;
  - `swisstopo-trail-service.ts` → route-file service (the `identify` call is removed, the mapper is kept);
  - `map-store` drops `clickableTrails`;
  - `map-page.vue` tap routing;
  - `trail-overlays.ts` data URL;
  - `offline-tile-service.ts` / `offline-map-cache.ts`.

  Also `src/sw.ts` and the locales (`map.trail.zoomIn` removed).
- **New:** `.github/workflows/ski-route-data.yml` and a build script under `scripts/ski-routes/`. CI tools:
  GDAL (`ogr2ogr`) and `tippecanoe`, installed in the Action only, not npm dependencies.
- **Infra:** a new Cloudflare Pages project `tourenbuddy-data`, deployed with the existing
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. The first data deploy must exist before the app
  change ships.
- **External API:** `api3.geo.admin.ch` identify no longer used. `data.geo.admin.ch` (STAC + GeoPackage)
  is read by the Action only.
- **DB / Worker:** none.
