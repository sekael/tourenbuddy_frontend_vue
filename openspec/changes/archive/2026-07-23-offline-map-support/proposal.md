## Why

TourenBuddy is used in the mountains, where there is often no connectivity — but
the map is the one thing a user most needs there. Today the app caches Swisstopo
tiles only opportunistically (`StaleWhileRevalidate`, 500-entry cap, 30-day
expiry): whatever you happened to pan over recently survives, nothing is
guaranteed, and the LRU cap silently evicts. Issue #245 asks for real offline
support; this change delivers its first, self-contained slice — **explicit,
user-chosen offline base maps** — so a user can deliberately download the area of
an upcoming tour and rely on it being there with no signal.

Scope here is the **base map only** (`ch.swisstopo.basemap.vt` vector tiles). The
full-colour Swisstopo raster ("classic") is explicitly out of scope — it is not
offered offline. The wider offline story (local data cache + online detection +
bidirectional sync for tours / contacts / profile / calendar / friendships) is a
separate, larger change **(b) offline-app-cache-sync** and is where the "no
offline data sync" architecture stance is reversed.

## What Changes

- **Spike first (blocking):** measure the real base-map footprint before building
  anything sized around a guess — total tile size across zoom levels for a region,
  the source's true `maxzoom` (vector tiles overzoom client-side; we download to
  `maxzoom`, not display zoom), browser storage **quota** limits and eviction
  behaviour (notably iOS Safari), plain-browser **vs** installed-PWA feasibility,
  and which store — Cache API vs IndexedDB — the service worker reads fastest for
  "prefer offline tile over online". Findings pin the numbers the rest of the
  change depends on.
- **Draw-a-rectangle region selection** on the map with a **live estimated
  download size** (tile count × measured average tile bytes) shown *before* the
  user confirms, plus a guard that refuses / warns when the estimate approaches
  available quota.
- **Whole-Switzerland download** as an explicit one-action option (region = the
  source `bounds`, ≈3.25 GB measured), offered where quota + durable storage
  permit — same download pipeline as a drawn region, same guard gating it on
  constrained devices.
- **Download the region to device** at full native zoom — not just `.pbf` tiles
  but also the **style.json, sprite (json + png), and glyph range PBFs** the style
  references, so labels and symbols render offline instead of a blank basemap.
  Progress + cancel; concurrency-limited; requests persistent storage to reduce
  eviction.
- **Offline-first tile serving:** the service worker serves a downloaded tile (or
  style/sprite/glyph asset) from the explicit offline cache **whenever present**,
  hitting the network only on a miss — so a downloaded region always wins over the
  opportunistic runtime cache and over online, per the issue's general rule.
- **Manage downloaded maps:** a UI to list downloaded regions (label, extent, zoom
  range, tile count, size), show total storage used against the browser quota, and
  **delete** a region to reclaim space.
- **Architecture doc note** updated for tiles (explicit offline base-map download
  now exists). The "no offline data **sync**" line is left standing — it dies in
  change (b), not here.

## Capabilities

### New Capabilities
- `offline-map`: user-selected, explicitly-downloaded Swisstopo base-map regions
  for offline use — region selection with size estimate, full-zoom download of
  tiles + style/sprite/glyph assets, offline-first serving, and download
  management (list / storage usage / delete).

### Modified Capabilities
<!-- none — `pwa-support` is untouched; offline-first tile routing is new behavior
     owned entirely by the new `offline-map` capability. -->

## Impact

- **Service worker (`src/sw.ts`):** a new offline-first handler for the
  `vectortiles.geo.admin.ch` base-map origin (tiles + `style.json` + sprite +
  glyphs) registered **before** the existing `swisstopo-tiles` SWR route, reading
  a dedicated `offline-map-tiles` Cache; falls through to the current SWR route on
  a miss. Existing WMTS / GPX / attachment routes unchanged.
- **New feature code (`src/features/map/`):**
  - `data/services/offline-tile-service.ts` — enumerate tile URLs for a bbox ×
    zoom range, enumerate style/sprite/glyph asset URLs, write them to the
    `offline-map-tiles` Cache with bounded concurrency + progress + cancel.
  - `data/services/offline-region-store.ts` — IndexedDB metadata index (one record
    per downloaded region: id, label, bbox, zoom range, tile URL list / count,
    bytes, createdAt); used by the manage UI and by delete-to-purge.
  - `presentation/stores/offline-map-store.ts` — Pinia store: downloaded regions,
    live estimate, download progress/cancel, delete, `navigator.storage.estimate()`
    usage/quota.
  - `presentation/components/` — rectangle-draw overlay + download sheet (estimate,
    confirm, progress) and a manage-downloads sheet.
- **Rectangle draw:** implemented with a lightweight native drag handler on the
  MapLibre canvas — **no new mapping dependency** (`mapbox-gl-draw` et al. not
  pulled in for a single rectangle).
- **Storage APIs:** Cache API (tiles/assets, URL-keyed — SW-native, no manual
  key/Response plumbing) + IndexedDB (region metadata) + `navigator.storage`
  (`estimate`, `persist`). Store choice validated by the spike.
- **i18n:** new keys in `en.json` + `de-CH.json` (download CTA, estimate/size,
  progress, quota warning, manage list, delete confirm, offline empty states).
- **Docs:** `.claude/architecture.md` PWA section — tile note only.
- **No DB / migration changes. No Worker changes. No new npm dependency** (subject
  to the spike's storage-wrapper finding).
