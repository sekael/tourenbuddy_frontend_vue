# Design

## Context

See proposal.md for motivation. Current state (from the archived `trail-overlays` design, D5):

- `use-trail-lookup.ts` loads every ski route crossing the viewport via `identifySkiRoutes` on `moveend`
  (z ≥ 12), keeps the routes with route info in `trails`, and mirrors them into `map-store.clickableTrails`.
- `trail-layers.ts` draws them from a GeoJSON source (`trail-clickable`): a halo under the ski raster and
  canvas badges (`ski-badge.ts`, ids `ski-badge|<color>|<label>`, drawn on `styleimagemissing`).
- A tap ranks the loaded routes locally (`map.project` + `nearestOnPolylines`, 24/10 px, max 8). The highlight
  source and `frameBounds` use `Trail.lines`.

Dataset facts (measured 2026-10-15 on the 2025-12-15 release):

- 10,789 lines, 2,941 with a target, all `swisstopo_sac`. The GeoPackage is LV95 (EPSG:2056). The routes with
  a target have 614k vertices: 10.8 MB of JSON, 3.2 MB gzip at full resolution.
- The source has a numeric `difficulty` grade (e.g. `ZS` → 7) next to the `difficulty_<lang>` labels. German
  uses SAC notation, en/fr/it the French one. Six routes differ between en/it/fr.
- Tiles touched by these routes: 823 up to z12, 2,615 up to z13, 7,789 up to z14. Cloudflare Pages (free)
  allows 20,000 files and 25 MiB per file.
- A z13 tile's 4096 grid is about 0.8 m at 46.5° N. Below z11 nothing reads the vector tiles (the raster draws), so none are built: ≈2.5k tiles at z11–z13. The data is accurate to metres, so z14+ tiles would add
  bytes without adding information.

## Goals / Non-Goals

**Goals:**
- Routes marked and tappable from z11 (the raster keeps drawing every route at all zooms), with no request per pan apart from new map tiles.
- Highlight, framing and snapping groundwork always work on the complete route geometry.
- Data refresh with zero manual steps, independent of app releases.

**Non-Goals:**
- Replacing the WMTS ski raster. It still draws the network, including routes without info.
- Offline taps, and per-route files in region downloads.
- A generic self-hosted-dataset framework. Hiking stays on WMTS.

## Decisions

### D1 — Static vector tiles + per-route files on a separate Pages project

Published layout (`https://tourenbuddy-data.pages.dev`):

```
/ski-routes.json                          TileJSON 3.0 — stable URL, the only mutable file
/ski-routes/<version>/{z}/{x}/{y}.pbf     MVT, z11–z13, layer `routes`
/ski-routes/<version>/routes/<id>.json    GeoJSON Feature, full geometry + all attributes
/_headers                                 CORS `*`; `immutable, max-age=31536000` on /ski-routes/*
```

`<version>` is the gpkg asset's STAC `updated` timestamp without colons/fraction (`2025-12-15T091422`). The TileJSON carries `tiles`, `minzoom: 11`,
`maxzoom: 13`, `bounds`, `attribution: "©swisstopo"`, `version`. About 5.6k files in total.

*Alternatives:*
- **Supabase PostGIS + bbox RPC.** It keeps a per-viewport payload, now billed against the 5 GB/month free
  egress. It also adds a migration and an RPC, and free-tier latency.
- **One static GeoJSON file.** About 3.5 MB gzip and 11 MB of JSON to parse before the first route shows; a
  20 m simplification visibly cuts corners at z15.
- **PMTiles.** It needs a new dependency and Range requests, and the Cache API handles `206` poorly, which
  breaks CacheFirst and offline.
- **In the app's own `dist/`.** Data freshness would then depend on app releases. That is exactly what we
  don't want: the app may stop getting releases while the data keeps updating.

### D2 — Hybrid: tiles to mark and hit-test, route files for the card

Tiles clip at tile edges and simplify below z13, so they can't give one continuous geometry per route.
Each feature in the `routes` layer carries only what marking and hit-testing need: `id` (the GeoPackage
SAC route id `sacid` as a string — the SAC portal's own id, stable across releases unlike the GeoPackage `fid`, and what future tour↔route links would store), `grade` (the app's own `skiDifficultyGrade` of `difficulty_de`, imported by the build so halo and badge colors can't diverge; may be null) and `difficulty_de`/`_fr`/`_it`/`_en`.
Everything else, including the full geometry, lives in `routes/<id>.json`. That is the exact feature shape
the current mapper already handles (`properties` = Swisstopo fields, `LineString | MultiLineString`), so
`mapSkiRoute` and its Zod schema are kept as they are. `Trail`, `trail-card`, the highlight source and
`frameBounds` stay unchanged.

*Alternative:* highlight by filtering the vector layer on the route id, with the bbox baked into the
tiles. Rejected (user decision): the route is only drawn where tiles are loaded and is simplified below z13,
and snapping (#324 D6) needs full polylines anyway.

### D3 — Build pipeline: `ogr2ogr` → Node script → `tippecanoe`

`scripts/ski-routes/build.ts` (run with `npx tsx`, the repo's script convention), run by the Action:

1. `ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 -where "target_name IS NOT NULL AND source = 'swisstopo_sac'"`
   with `-lco COORDINATE_PRECISION=6`. 6 decimals is about 0.1 m, which is lossless relative to the data.
2. The Node script streams the features. It writes `routes/<id>.json`, and writes a slim
   `tiles-input.geojsonseq` with the D2 properties.
3. `tippecanoe -Z11 -z13 -l routes --buffer=<halo>` with no dropping (`--no-feature-limit
   --no-tile-size-limit`) and no edge simplification (`--no-simplification-of-shared-nodes`). Output is a
   directory, uncompressed (`--no-tile-compression`): Pages compresses on the fly, and gzip-on-disk would
   need a `Content-Encoding` header.
4. Write `ski-routes.json` and `_headers`.

The buffer covers the halo width + blur (≈ 12 px of 256), so halos join at tile edges. That gets checked
visually at a tile edge.

GDAL and tippecanoe come from apt on the pinned `ubuntu-24.04` runner (`gdal-bin`, `tippecanoe` 2.49 from universe — verified). No npm dependency
is added.

### D4 — Scheduled workflow `ski-route-data.yml`

- **Triggers:** `schedule: '17 4 * * 1'` (weekly, Mon 04:17 UTC — Swisstopo releases mid-December at season start, so a ≤7-day lag; a no-change run costs ~15 s) + `workflow_dispatch` (`force: boolean`).
- **Check:** read the STAC collection `updated` and the deployed `ski-routes.json` `version`. If they are
  equal and not `force`, skip to keepalive. A missing manifest (first run) means build.
- **Build** (D3), then `wrangler pages deploy out --project-name tourenbuddy-data --branch main` with the
  existing `CLOUDFLARE_*` secrets (`wrangler pages project create … || true` beforehand, so the first run
  bootstraps the project).
- **Keepalive:** every run ends with `gh workflow enable ski-route-data.yml` (`permissions: actions:
  write`), even on the skip path.
  - *Why:* GitHub disables scheduled workflows in public repos after 60 days without activity, which is
    the "no app releases for years" case.
  - *Unverified:* whether this resets the timer (proof takes 60+ idle days). Accepted: GitHub emails a
    warning before disabling, and re-enabling is one click (runbook). A state check ~2 months after merge
    settles it; if disabled, switch to a bot commit as activity.
  - *Rejected:* a Worker cron firing `repository_dispatch`. It needs a GitHub token in Worker secrets, and
    fine-grained tokens expire. That is a hidden recurring manual task that fails silently.
- **Failure handling:** nothing deploys and the old version stays live (stale data, never a broken app).
  Notification is GitHub's failed-scheduled-run email, no extra alerting. `force` skips **only** the ±30%
  count check (a heuristic: a real dataset jump is unblocked with one manual run); uniqueness, file
  completeness and tile size are always enforced (those are always bugs). Runbook: `docs/ski-route-data.md`.
- **Sanity gate before deploy:** route count within ±30% of the previous manifest's `count` (when present),
  and `sacid` is non-null and unique, every tile route id has a route file, and no tile exceeds 50 KB (estimate ≈2 KB; catches a broken build). A broken release then fails the job instead of blanking the app.

### D5 — Client: vector source in the existing stack

`trail-layers.ts` replaces the `trail-clickable` GeoJSON source with
`{ type: 'vector', url: SKI_ROUTES_TILEJSON }`. MapLibre reads the TileJSON natively, so versioning is
transparent. The stack order and layer ids stay the same, so the draw-order requirements don't change.

- **Halo:** `source-layer: 'routes'`, `minzoom: 11`, and `visibility` follows the ski overlay (today it's
  implicitly empty data). Color comes from a MapLibre `interpolate` on `grade`. The stops are the
  same as `GRADE_COLORS` at grades 1, 4, 7, …, since `gradeColor` mixes linearly in RGB like `interpolate`.
  A `case` gives grey for null. `ski-badge.ts` exports the stops so there is one ramp.
- **Badges:** `minzoom: 11`, `icon-image: ['concat', 'ski-badge|', ['get', labelField]]`.
  - `labelField` is `difficulty_<lang>`, falling back to `difficulty_de` / `difficulty_fr` as `mapSkiRoute`
    does. It is set with `setLayoutProperty` on locale change.
  - `styleimagemissing` derives the color from the label (`skiDifficultyGrade` → `gradeColor`), so the id
    drops the color segment.
- **Removed:** `clickableTrails` (store + `setClickable` + watch), `syncClickableTrails`, the `moveend`
  refresh, and `identifySkiRoutes`. The constant `TRAIL_LOOKUP_MIN_ZOOM` becomes 11 and is shared by the
  halo `minzoom` and tap routing.

### D6 — Tap resolution

`useTrailLookup.lookup(point)`:

1. `queryRenderedFeatures([[x−tol, y−tol], [x+tol, y+tol]], { layers: [halo] })`. This returns tile
   fragments with geometry in lng/lat, possibly several per route.
2. **Dedupe and rank (user's gap):** project each fragment, `nearestOnPolylines` against the tap, keep the
   minimum distance per `id`, drop anything over tolerance, sort nearest first, return 8 ids + `more`.
   Distance on fragments is exact for this purpose: the part of a route nearest the tap is always inside
   the queried box.
Steps 1–2 form a synchronous `hitTest(point)` that needs no network, so the offline branch reuses it.

3. Fetch `routes/<id>.json` for those ids in parallel (≤ 8, ~1 KB each, cache-first) and map them with
   `mapSkiRoute`. One `AbortController` per lookup, and a newer tap aborts the older one (same
   owner-check as today).
4. Any fetch or validation failure → `onError` (the existing `lookupError` snackbar) and no card. A partial
   list is never shown, because the card must open with final content.

Route-file URLs are built from the loaded source's TileJSON template (`map.getSource(...).tiles[0]` with
`{z}/{x}/{y}.pbf` replaced by `routes/<id>.json`), so tiles and route files never mix versions.

`map-page.vue` tap routing: the `zoom < 12 → snackbar` branch becomes `zoom < 11 → closeOverlay()`. Offline: the same rendered-feature hit test runs (tiles render offline), and a hit shows
`map.trail.offline` ("Route details need a connection.", error tone, matching `tours.suggestions.offline`-style
copy) instead of fetching; a miss closes overlays as today. The
`info` tone of `ErrorSnackbar` and `map.trail.zoomIn` lose their only caller and are removed. 

### D7 — Offline region download

`offline-tile-service.ts` adds the ski-route tile template to its tile list, read from the cached
TileJSON, for zooms ≤ 13. The tiles go into `offline-map-tiles` under a **version-less key**
(`normalizeTileUrl` strips `/ski-routes/<version>/`, the same idea as the `vectortiles0-4` shard
normalization).

*Why version-less:* after a yearly refresh, the online app caches the new TileJSON. Offline later, the
map would ask for new-version URLs that a region downloaded earlier doesn't have. Stripping the version
lets old downloaded tiles answer. They are slightly stale, but marking stays consistent, and taps are
offline-disabled anyway. Size estimates include the tile count; the per-zoom footprint is tiny next to
the base map.

### D8 — Service worker routes

These are registered before the generic routes:

- `ski-routes.json` → `NetworkFirst` (3 s network timeout) in `ski-route-data`.
- `/ski-routes/*` tiles → offline cache first (version-less key), else `CacheFirst` in `ski-route-data`.
- Route files → `CacheFirst` in `ski-route-data`.
- `ExpirationPlugin` with 3000 entries and 30 days. Old-version entries age out on their own.

### D9 — Version switch without visible errors

1. **Redirect.** The build reads the previous `version` from the live manifest and writes
   `/ski-routes/<previous>/*  /ski-routes/<current>/:splat  302` into `_redirects`. Tile addresses and
   `sacid` file names are identical across versions, so the redirect is correct by construction. Only the
   immediately previous version is redirected; older clients are covered by step 2. *Unverified:* that
   Pages adds the `_headers` CORS header to the 302 (needed for a cross-origin redirect). Checked in task 2.3.
2. **Self-heal in the client.** `refreshSkiManifest()` calls `source.setUrl(SKI_ROUTES_TILEJSON)`, which
   makes MapLibre refetch the TileJSON (NetworkFirst) and reload the tiles. It is throttled to once per
   10 min.
   - A route-file 404 → refresh, rebuild the URL from the new template, retry once. A second 404 means the
     route was removed: treat it as a miss (no card, no snackbar).
   - A ski-source tile `error` event (`map.on('error')`, filtered on the source id) **without an HTTP
     status** (CORS/network failure, i.e. a blocked redirect) → refresh. A tile `404` is NOT a trigger: the
     tile set is sparse (no file where no route runs), so 404 is the normal empty-tile answer. Locally
     (`wrangler pages dev`) the 302 carries `Access-Control-Allow-Origin`, so this is only the safety net.
   - Only network or validation failures keep the existing `lookupError` snackbar.

## Risks / Trade-offs

- [The keepalive doesn't reset GitHub's 60-day timer] → Verified in task 2.4. GitHub emails before it
  disables the workflow. Re-enabling is one click; a check ~2 months after merge settles it (D4).
- [Swisstopo changes the schema or columns in a release] → The sanity gate fails the job and the old
  version stays live. The Zod schema in the app rejects bad route files, and the tap shows the error
  snackbar.
- [The deploy replaces all files, so a running client holding the old TileJSON requests dead paths] →
  Redirect plus client self-heal (D9). The user sees no error.
- [Pages file limit (20k)] → 5.6k now. Growth is yearly and slow, and the sanity gate logs the count.
- [The vector halo shows a route while its raster tile isn't loaded yet, or vice versa] → Both load in the
  same frames; this is cosmetic.
- [Routes are visible offline but can't open] → A tap on one explains it ("Route details need a
  connection") instead of failing silently. A GPX track covers offline route needs.
- [z11 lists hit the 8-row cap often] → "+N more — zoom in" already covers this.

## Migration Plan

Two PRs, because GitHub only offers `workflow_dispatch`/`schedule` for workflows on the default branch:

1. **PR 1 — data pipeline** (tasks 2.x): build script, workflow, docs. No app behavior change. After merge,
   trigger the workflow by hand and verify `https://tourenbuddy-data.pages.dev/ski-routes.json` serves with
   CORS and a tile + route file load.
2. **PR 2 — app** (tasks 3–5): client, SW, offline, built and preview-tested against the live data. On the
   next SW update the new caches appear; `swisstopo-trail-overlays` stays for the raster.
3. Rollback: revert PR 2 (falls back to `identify`); the data project can stay up untouched.

No DB or Worker change.
