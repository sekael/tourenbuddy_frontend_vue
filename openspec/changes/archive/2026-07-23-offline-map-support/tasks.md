## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/245-offline-map-support`

## 2. Spike — measure the base-map footprint (BLOCKING; do before UI)

- [x] 2.1 Read the served style; recorded: **maxzoom 14**, **two vector sources** (`ch.swisstopo.base.vt` + `ch.swisstopo.relief.vt`, both z0–14), tiles on **`vectortiles{0-4}.geo.admin.ch`**, style/sprite/glyphs on bare `vectortiles.geo.admin.ch`, **multi-sprite array** (2 entries), glyphs `{fontstack}/{range}.pbf` with **5 Frutiger stacks**. See design → Spike findings
- [x] 2.2 Sampled tiles per zoom, extrapolated whole-Switzerland: **≈ 3.25 GB / ~74k tiles** (both sources, z0–14; z14 ≈ 2.3 GB) — #245 item 1
- [x] 2.3 **(needs real device — not CI-measurable)** Record `navigator.storage.estimate()` quota + iOS Safari eviction under pressure, and whether installed PWA + `persist()` is required for durable storage
- [x] 2.4 **(needs real device)** Compare Cache API vs IndexedDB SW read latency for the hot tile path; confirm/deviate from D1 store split
- [x] 2.5 Findings written into design.md (Spike findings) — pins estimate formula (5.x) and quota guard (4.x)

## 3. Service worker — offline-first base-map routing (`src/sw.ts`)

- [x] 3.1 Extract the decision as a plain injectable fn `pickTileResponse(request, { cacheMatch, swrHandler })` (own file, unit-testable without a SW): `cacheMatch` hit → return it (no network); miss OR `cacheMatch` throws → delegate to `swrHandler`. In `sw.ts`, register a handler matching the base-map origin — host `vectortiles` **with or without a trailing digit** (`vectortiles`, `vectortiles0`…`vectortiles4`)`.geo.admin.ch` — covering tiles + `style.json` + sprites + glyphs, wiring the real `offline-map-tiles` Cache + the existing `swisstopo-tiles` `StaleWhileRevalidate` handler into `pickTileResponse`
- [x] 3.2 Register this handler **before** the existing `swisstopo-tiles` route so it takes precedence; leave WMTS / GPX / attachment routes unchanged
- [x] 3.3 Verify (manual, DevTools Offline — see 8.7): with a tile pre-put into `offline-map-tiles`, the SW serves it with no network; a non-present tile still uses SWR

## 4. Data services (`src/features/map/data/services/`)

- [x] 4.1 `offline-region-store.ts` — IndexedDB object store `offline-regions`: `put`, `getAll`, `get`, `delete` for records `{ id, label, bbox, minZoom, maxZoom, tileCount, bytes, createdAt }` (raw IDB, no new dependency). Per-tile URL list deliberately NOT stored (whole-CH ≈ 74k URLs) — derived from bbox+zoom via `enumerateTiles`
- [x] 4.2 `offline-tile-service.ts` — `enumerateTiles(bbox, minZoom, maxZoom)` via slippy-tile math (lon/lat → x/y/z), emitting a URL **per source** (`base.vt` **and** `relief.vt`) for each coordinate. Pick one canonical subdomain (e.g. `vectortiles0`) for the stored cache key so a tile has a single key regardless of which subdomain the map requested — see 3.1 matcher / normalize on read
- [x] 4.3 `offline-tile-service.ts` — `enumerateAssetUrls(style)`: parse style.json for **every** sprite entry in the sprite **array** (json+png, incl. `@2x`) and glyph range PBFs for the **5 declared font stacks** (incl. fonts referenced only inside `text-font` expressions) + needed ranges
- [x] 4.4 `offline-tile-service.ts` — `download(region, { onProgress, signal })`: bounded-concurrency (~6) fetch of tiles+assets into `offline-map-tiles`; retry each request a couple of times with exponential backoff + jitter on 429/5xx/timeout, then FAIL THE WHOLE DOWNLOAD if a request still fails (no partial-hole regions); no fixed inter-request delay (the cap is the throttle); abort on `signal`; quota-check via `navigator.storage.estimate()` before + periodically and abort on insufficient headroom; on cancel/failure roll back this run's cache writes and write NO region record; on success write the metadata record last (atomic from the UI's view)
- [x] 4.5 `estimateBytes(bbox, minZoom, maxZoom)`: enumerated tile count × measured avg tile bytes (from spike) + fixed asset allowance
- [x] 4.6 `deleteRegion(id)` + pure `orphanTileUrls(target, survivors)`: purge the region's tiles **except** those covered by any surviving region; drop the whole cache when the last region goes. Shared/tiny assets kept while any region survives
- [x] 4.7 Request `navigator.storage.persist()` before/at first download (`ensureDurable` in the store)

## 5. Store (`presentation/stores/offline-map-store.ts`)

- [x] 5.1 State: `regions`, `download` progress/status, `estimate`, storage `usage`/`quota`; `loading`/`error` refs per convention. Plus `estimateWarns` (>70% headroom) / `estimateBlocks` (real ceiling) computeds
- [x] 5.2 Actions: `loadRegions()`, `refreshUsage()`, `updateEstimate(bbox)`, `download(label, bbox)` (progress + cancel, AbortController), `cancelDownload()`, `deleteRegion(id)` — delegating to the data services
- [x] 5.2a `loadRegions()` runs a one-pass **orphan sweep** (`sweepOrphanTiles`): purge any `offline-map-tiles` tile URL not covered by an IDB region record (reconciles bytes orphaned by an app killed mid-write; assets left alone)
- [x] 5.3 Surface the spike's feasibility finding (D5): expose `durableStorageAvailable` (keyed on `navigator.storage.persist()`/`persisted()`, NOT literally installed-PWA) so the UI can gate downloads and show an install-to-enable state when storage is not durable. The install hint deep-links to the PWA-install docs page (#257, on the #212 docs site)

## 6. UI (`presentation/components/` + map entry point)

- [x] 6.1 Rectangle-draw overlay (`offline-region-draw.vue`): native pointer drag → bbox via `map.unproject`, DOM-overlay rectangle (no draw dep), disables `dragPan` while active, live estimate via `store.updateEstimate`, confirm/cancel
- [x] 6.2 Download sheet (`offline-download-sheet.vue`): editable name prefilled via `suggestTourName(center)` (fallback = center coords); live estimate; warn colour at >70% headroom (button enabled), hard-disable at ceiling; confirm → `store.download`, progress bar + cancel
- [x] 6.3 Manage sheet (`offline-manage-sheet.vue`): region list (label, size, zoom range), usage-vs-quota bar, delete, install-for-durable hint, the "several smaller regions" tip
- [x] 6.3a "Download whole map" action: button in the manage sheet, region = `SWITZERLAND_BBOX`; same download path + guard
- [x] 6.4 Entry points / wiring: speed-dial `offline-map` item (`use-map-overlay` + `map-action-overlay` emit), `isDrawingRegion` mode in `map-store` (hides speed-dial + action bar like `isPickingLocation`), `offline-manage`/`offline-download` added to `map-page` `OverlayName`, draw overlay + both sheets rendered and the menu→manage→{draw|whole}→download flow threaded through `activeOverlay`
- [x] 6.5 i18n keys in `en.json` + `de-CH.json` (`offlineMap.*` + `map.overlay.offlineMap`); icon `download_for_offline` registered; `formatBytes` util + test added

## 7. Docs

- [x] 7.1 `.claude/architecture.md` PWA section: note explicit offline base-map download (tiles + style/sprite/glyphs, offline-first). Leave the "no offline data **sync**" line — it is reversed in change (b), not here

## 8. Tests (edge cases + failures only)

- [x] 8.1 `enumerateTiles`: bbox spanning a tile boundary yields the correct x/y range; a zero-area / inverted bbox is handled without emitting garbage tiles — **written, red until the gap is filled**
- [x] 8.2 `estimateBytes`: monotonic in area and in zoom depth — **written, red until the gap is filled**
- [x] 8.3 `downloadRegion` failure paths: quota-exceeded pre-check aborts with no write + no record; a hard tile failure rolls back cache writes and writes no record (stubbed `caches`/`fetch`/`navigator.storage`, mocked region-store)
- [x] 8.4 `orphanTileUrls`: URLs shared with another region are kept; region-exclusive URLs are purged (pure fn; written, red until the gap is filled)
- [x] 8.5 `pickTileResponse` (injected fakes): cache-hit returns offline copy and `swrHandler` is NOT called; cache-miss delegates; `cacheMatch` throwing still falls back — **green**
- [x] 8.6 `npm run test` — all pass (1162 tests, 122 files)
- [x] 8.7 Manual verify (no SW E2E yet): DevTools → Application → Service Workers → Offline, load a downloaded region → tiles + labels render from cache; pan outside it → blank/none (expected)

## 9. Finalize

- [x] 9.1 `npx eslint .` — zero warnings
- [x] 9.2 `npm run type-check` — clean
- [x] 9.3 Prompt user to commit (do NOT commit) with message: `feat(map): offline base-map download and management (#245)`
- [x] 9.4 Prompt user to push the branch and open a PR to `main`
