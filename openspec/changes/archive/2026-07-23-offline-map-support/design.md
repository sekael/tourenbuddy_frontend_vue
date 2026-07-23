## Context

The base map is `ch.swisstopo.basemap.vt` — **vector** tiles served from
`https://vectortiles.geo.admin.ch`, configured in
`src/features/map/data/swisstopo-styles.ts` (the "classic" WMTS raster style is a
separate, larger source and is explicitly *not* an offline target). A MapLibre
vector style needs four kinds of resource to render: the `style.json`, the
sprite (`{sprite}.json` + `{sprite}.png`, and `@2x` variants), the **glyph** PBFs
(`{glyphs}` template = `{fontstack}/{range}.pbf`, one file per 256-codepoint
range per font stack the style uses), and the `.pbf` **tiles** themselves. Cache
only the tiles and MapLibre renders squares with no labels; all four must be
downloaded.

Today `src/sw.ts` caches base-map tiles with `StaleWhileRevalidate`
(`swisstopo-tiles`, 500-entry LRU, 30-day expiry). That is *opportunistic* — no
guarantee a given area survives, and the LRU cap evicts. This change adds an
*explicit* store the user fills deliberately and that the SW prefers.

Vector tiles **overzoom**: the source stops at some `maxzoom` (Swisstopo basemap
is ~14–15; the spike confirms) and MapLibre renders display zooms above it by
scaling the `maxzoom` tile client-side. So "full native zoom" means *download to
the source `maxzoom`* — there are no z16 `.pbf` files to fetch. This is the single
biggest size bound and must be measured, not assumed.

## Goals / Non-Goals

**Goals**
- A user draws a rectangle, sees an accurate size estimate, and downloads that
  base-map region (tiles + style + sprite + glyphs) for offline use.
- A user can also download the **entire** Swiss extent (≈3.25 GB) in one action
  where quota/durable-storage permits — same pipeline, region = source `bounds`.
- A downloaded tile/asset is served offline-first — preferred over the network and
  over the opportunistic runtime cache — whenever present.
- The user can see what's downloaded, how much space it uses vs the browser quota,
  and delete regions.
- The download is bounded and safe: quota-checked before/while writing, cancelable,
  and requests persistent storage to resist eviction.

**Non-Goals**
- No offline **data** (tours/contacts/etc.) — that is change (b).
- No offline of the WMTS "classic" raster style.
- No automatic/background region download or predictive prefetch — download is an
  explicit user action.
- No cross-device sync of *which* regions are downloaded (device-local by nature).
- No new mapping/draw dependency.

## Decisions

### D0 — Spike gates the rest (blocking)
The download UX, the estimate, and the quota guard are all sized by numbers we do
not yet have. Before building UI, measure and write down: (a) tiles-per-zoom and
bytes for a sample region up to source `maxzoom`, and the extrapolated
whole-Switzerland figure requested in #245 item 1; (b) the source's real
`maxzoom`; (c) `navigator.storage.estimate()` quota on target browsers and iOS
Safari eviction behaviour under storage pressure; (d) whether plain-browser (no
install) gives usable quota + SW interception, or whether installed-PWA +
`navigator.storage.persist()` is effectively required; (e) Cache API vs IndexedDB
read latency in the SW for the hot tile path. Findings are recorded in the change
(design update / task notes) and pin D1–D3.

### Spike findings (2026-07-20) — measured, supersede prior guesses

Fetched the live style + TileJSONs + sampled tiles:

- **Source `maxzoom` = 14** (both sources; `minzoom` 0, scheme xyz). "Full native
  zoom" = z14; nothing above is a real `.pbf` (MapLibre overzooms).
- **The base map is TWO vector sources**, not one: `ch.swisstopo.base.vt/v1.0.0`
  **and** `ch.swisstopo.relief.vt/v1.0.0` (hillshade). Every `(z,x,y)` is **two**
  tile fetches. Tile enumeration MUST emit both source URLs per coordinate.
- **Tiles are served from 5 subdomains** `https://vectortiles{0-4}.geo.admin.ch`,
  template `…/{z}/{x}/{y}.pbf`. The **style.json, sprite, and glyph** URLs are on
  the **bare** `https://vectortiles.geo.admin.ch`. → The SW matcher and the origin
  filter MUST cover `vectortiles` **with or without** a trailing digit.
- **Sprite is a multi-sprite ARRAY** (two entries, id + `default`), each with
  `.json` + `.png` + `@2x`. Asset enumeration MUST loop every sprite entry, not
  assume one.
- **Glyphs:** `…/fonts/{fontstack}/{range}.pbf`, **5 font stacks** (`Frutiger Neue
  Regular / Italic / Medium / Condensed Regular / Condensed Medium`) — including
  the ones referenced only inside data-driven `text-font` expressions.
- **Whole-Switzerland footprint ≈ 3.25 GB / ~74k tiles** (both sources, z0–14);
  z14 alone ≈ 2.3 GB. Manageable on modern devices → **whole-map download is an
  explicit in-scope option** (a "download all of Switzerland" action using the
  source `bounds`), **gated on feasibility**: offered only where `estimate()`
  quota headroom + durable storage allow (see D5); on constrained devices (iOS
  Safari) it may be blocked by the same quota guard that governs regions. The
  quota guard, `persist()`, and the "prefer several smaller regions" tip stay
  load-bearing for exactly those devices.

Still **needs real-device verification** (not measurable from CI): iOS Safari
quota + eviction under pressure (2.3), and Cache-API vs IndexedDB SW read latency
(2.4). D1's store split stands unless 2.4 contradicts it.

### D1 — Two stores: URL-keyed Cache API for assets, IndexedDB for the region index
Tiles, style, sprite and glyph responses go in a dedicated **Cache API** cache
`offline-map-tiles`, keyed by request URL. Cache API is the right primitive here:
the SW hot path is "do I have this exact tile URL?", which is a native
`cache.match(request)` — no manual key derivation, no `Response`
reconstruction, and it is writable from the window context (the download runs on
the main thread and the SW just reads the same-named cache).

A separate **IndexedDB** object store `offline-regions` holds one metadata record
per download — `{ id, label, bbox, minZoom, maxZoom, tileUrls | tileCount, bytes,
createdAt }`. This is the "explicit availability store" #245 asks about: the
manage UI lists from it, and **delete** uses the stored URL set to purge exactly
this region's entries from the Cache (URLs shared with another still-present
region are kept — delete removes only URLs no other region references).
- *Why not IndexedDB for the tiles too?* The SW would then hand-roll key lookups
  and rebuild `Response`s on every tile request — slower and more code for the hot
  path. The spike (D0e) validates this; if IDB reads win decisively, revisit.
- *Why not Cache API for the metadata?* It is not URL-shaped queryable data;
  listing/sizing/deleting regions wants a real record store.

### D2 — Offline-first SW routing, registered before the SWR route
A new handler matches the base-map origin (`vectortiles.geo.admin.ch` — tiles,
`style.json`, sprite, glyphs) and does: **try `offline-map-tiles` first**
(`caches.open('offline-map-tiles').then(c => c.match(request))`); on hit, return
it (never touch the network); on miss, **delegate to the existing
`StaleWhileRevalidate` `swisstopo-tiles` handler**. It is registered **before**
the current SWR route so it takes precedence (Workbox evaluates routes in
registration order). Net effect: a downloaded tile always wins over online and
over the opportunistic cache; anything not downloaded behaves exactly as today.

**Subdomain normalization.** Tiles are sharded across `vectortiles{0-4}` and
MapLibre round-robins them, but Cache API keys by full URL (host included) and
`cache.match` cannot ignore host. So both write and read normalize the host digit
away → canonical `vectortiles.geo.admin.ch`: download does
`cache.put(canonicalUrl, response)`; the SW rewrites `vectortiles\d?` →
`vectortiles` before `cache.match`. One key per logical tile; any shard URL
resolves to it. Path still separates `base.vt` from `relief.vt`, so only the digit
is stripped.
- *Why a custom handler, not a second `CacheFirst` route on a different cache?* A
  plain `CacheFirst` route claims the request whether or not the tile is present,
  so a partial download (or a tile outside the region at a needed zoom) would 404
  from cache instead of falling back online. The try-then-delegate handler falls
  back on miss, which is the behaviour we want.

### D3 — Download: enumerate → bounded fetch → cache, with estimate, progress, cancel
`offline-tile-service` enumerates, for the bbox and `[minZoom..maxZoom]`, the
`(x, y, z)` tile coordinates (standard slippy-tile math: lon/lat → tile x/y per
zoom), maps each to its URL, and appends the style/sprite/glyph asset URLs (parsed
from the fetched `style.json`; glyph ranges limited to the fonts the style
declares and the Latin ranges CH labels use — the spike confirms the set).
Download writes each response into `offline-map-tiles` with a **concurrency cap**
(≈6) and reports progress (done / total). It is **cancelable** (AbortController);
a canceled or failed download rolls back its partial cache writes and writes no
metadata record. Before starting, and periodically while running, it checks
`navigator.storage.estimate()` and aborts if the projected total would exceed the
quota headroom.

The **live estimate** shown before confirm = enumerated tile count ×
measured-average tile bytes (from the spike / a small live sample), + a small fixed
allowance for style/sprite/glyphs. It updates as the rectangle changes.

### D4 — Rectangle draw with no new dependency
Region selection is a native drag on the MapLibre canvas: pointer-down starts a
box, drag sizes it (rendered as a MapLibre GL fill+line source or a DOM overlay),
pointer-up fixes the two corners → bbox. The estimate recomputes on every size
change. No `mapbox-gl-draw` / `terra-draw` — a single axis-aligned rectangle does
not justify a dependency.

### D5 — Eviction resistance & feasibility surfacing
Request `navigator.storage.persist()` before/at first download so the browser is
less likely to evict under pressure. Where the spike (D0d) shows a target browser
(e.g. iOS Safari, uninstalled) offers too little quota or no durable storage, the
UI surfaces that up front (a hint to install the PWA) rather than letting a
download silently fail or get evicted later.

## Risks / Trade-offs

- **iOS Safari quota + eviction** is the headline risk (small quota, evicts under
  pressure). Mitigations: `persist()` (D5), quota-guarded downloads (D3), and an
  install hint when durable storage is unavailable (D5). The spike quantifies it
  before we commit UX.
- **Full-zoom region size** can still be large even bounded by `maxzoom` overzoom
  (D-context). Mitigation: live estimate + quota guard *before* download (D3), and
  the user picks the extent.
- **Style/sprite/glyph drift** — if Swisstopo revises the style, a downloaded
  region's assets can lag the live style. Acceptable for a base map; the offline
  copy stays internally consistent (tiles + the style it was downloaded with). A
  future re-download refreshes it.
- **Shared-URL deletion** — two overlapping regions share tile URLs; delete must
  only purge URLs no surviving region references (D1), or it corrupts the other
  region. Covered by a test.
- **Partial download** — cancel/failure must not leave a "downloaded" region that
  is actually incomplete. Rollback + write-metadata-last (D3) makes a region
  atomic from the UI's perspective. Covered by a test.

## Open Questions

- Exact source `maxzoom` and the whole-Switzerland size figure — **answered by the
  spike (D0)**, which is the first task group and blocks the sizing-dependent UI.
- Final storage-wrapper choice (raw IndexedDB vs a tiny helper) — decided during
  D1 implementation; default is no new dependency.
