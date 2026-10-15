# Spec Delta

## MODIFIED Requirements

### Requirement: Runtime caching rules
The service worker SHALL apply these runtime strategies:
- Swisstopo vector tiles (`vectortiles*.geo.admin.ch`): explicitly downloaded offline-map entries first (see `offline-map`), otherwise stale-while-revalidate in `swisstopo-tiles` (500 entries, 30 days).
- Swisstopo trail-overlay WMTS tiles (`ch.swisstopo.swisstlm3d-wanderwege`, `ch.swisstopo-karto.skitouren`): cache-first in a dedicated `swisstopo-trail-overlays` cache (1500 entries, 30 days) — a cached tile SHALL be served without any network request until it expires.
- Other Swisstopo WMTS raster tiles: stale-while-revalidate (500 entries, 30 days).
- GPX objects in Supabase Storage: stale-while-revalidate (100 entries, 30 days).
- Tour attachment objects: network-only — signed URLs are short-lived and SHALL NOT be cached by the service worker.
- Welcome-screen background images: cache-first (4 entries, 30 days).

#### Scenario: Attachment fetch is never cached
- **WHEN** an attachment is fetched through a signed URL
- **THEN** the response does not enter any service-worker cache

#### Scenario: Cached overlay tile is not refetched
- **WHEN** a trail-overlay tile already in `swisstopo-trail-overlays` and younger than 30 days is requested
- **THEN** it SHALL be served from the cache and no network request SHALL be made for it

#### Scenario: Overlay tiles do not evict Classic tiles
- **WHEN** the user pans with overlays on
- **THEN** overlay tiles SHALL be stored only in `swisstopo-trail-overlays` and SHALL NOT count toward the Classic WMTS cache's entry limit
