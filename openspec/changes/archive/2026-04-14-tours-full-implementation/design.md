## Context

TourenBuddy tours currently store: id, userId, plannedDate, goal (lng/lat), name, partnerIds. All persisted via `create_tour_with_partners` RPC and read from `tours_view`. The tour creation dialog collects name, date, and partners. The info sheet displays these same fields.

Issue #19 requires expanding the tour model with activity type, elevation, GPX tracks, description, season, start/end points, equipment, and notes. Two fields (elevation, name) should auto-populate from Swisstopo APIs when a location is pinned.

Constraints: Supabase free tier (latency-sensitive), no API key needed for Swisstopo, all new fields optional, existing tours must remain valid.

## Goals / Non-Goals

**Goals:**

- Expand tour data model with all fields from issue #19
- Auto-retrieve elevation from Swisstopo DEM API on location pin
- Auto-suggest tour name from Swisstopo feature search on location pin
- Upload, store, and display GPX tracks on the map
- Adaptive UI that looks good with any combination of filled fields
- Maintain backward compatibility with existing tours

**Non-Goals:**

- Tour editing (update existing tours) — separate issue
- Offline GPX support or IndexedDB caching of GPX data
- Route planning / drawing routes on map
- Elevation profile visualization
- GPX export
- Full-text search across tour descriptions

## Decisions

### 1. Tour type as TypeScript string union + Zod enum

**Choice:** Define tour types as a Zod enum (`z.enum([...])`) mapped to a TypeScript type. Store as `text` column in Supabase with a CHECK constraint.

**Alternatives considered:**

- Integer enum with lookup table — adds join complexity, overkill for ~10 fixed values
- PostgreSQL enum type — harder to migrate when adding types

**Rationale:** String values are human-readable in DB, easy to extend, and Zod enum gives compile-time safety.

### 2. Swisstopo elevation API (rest-geoservices) with WGS84→LV95 transform

**Choice:** Use `https://api3.geo.admin.ch/rest/services/height?easting={E}&northing={N}&sr=2056` to get elevation at pinned coordinates. The API only accepts EPSG:2056 (LV95/CH1903+) or EPSG:21781 (LV03/CH1903) — **not** WGS84. We use EPSG:2056 (modern Swiss standard). A pure-math `wgs84ToLv95(lng, lat)` utility converts WGS84 coordinates to LV95 (easting/northing) client-side before calling the API. Call fires after location confirmation, before dialog opens. Result pre-fills elevation field; user can override.

**Coordinate transformation (WGS84 → LV95):**
The approximate formulas from swisstopo ("Formulas for the direct transformation") convert (lng, lat) in degrees to (E, N) in meters. Steps: (1) convert to arc-seconds, shift by Bern origin, (2) apply polynomial approximation. Accuracy ~1m — sufficient for elevation lookup. No external library needed.

**Alternatives considered:**

- Client-side DEM tile parsing — complex, large tile downloads
- Mapbox Terrain RGB tiles — requires API key, non-Swiss source
- EPSG:21781 (LV03) — legacy system being phased out, LV95 is current standard
- proj4js library for coordinate transform — heavy dependency for one conversion; the swisstopo published polynomial formulas are a few lines of code

**Rationale:** Swisstopo REST API is free, accurate for Swiss territory, single HTTP GET, returns JSON `{height: number}`. EPSG:2056 chosen over 21781 as it's the active Swiss reference frame. Graceful fallback: if API fails or location is outside Switzerland, leave elevation empty for manual entry.

### 3. Swisstopo feature search for name suggestion

**Choice:** Use `https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&searchText={lat},{lng}` (reverse geocode) to find nearby named features (peaks, passes, huts). Present top result as suggestion in the name field.

**Alternatives considered:**

- Nominatim/OpenStreetMap — less accurate for Swiss alpine features
- No auto-suggestion — worse UX for the majority case (mountain peaks)

**Rationale:** Swisstopo has authoritative Swiss geographic feature names. Fire alongside elevation call. Non-blocking: if no result, name field stays empty.

### 4. GPX handling — client-side parse, store as GeoJSON in Supabase

**Choice:** Parse GPX XML client-side using a lightweight parser (`@tmcw/togeojson` — ~5KB gzipped). Store converted GeoJSON in a `jsonb` column on the tours table. Render via MapLibre GeoJSON source + line layer.

**Alternatives considered:**

- Store raw GPX XML — requires re-parsing on every load, larger storage
- Supabase Storage for GPX files — adds file management complexity, separate fetch
- PostGIS geometry column for track — complex for multi-segment tracks with metadata

**Rationale:** GeoJSON is MapLibre-native (zero conversion at render time), `jsonb` is queryable, and `@tmcw/togeojson` is battle-tested and tiny. File size limit: 2MB raw GPX (enforced client-side).

### 5. Season as text array column

**Choice:** Store season as `text[]` in Supabase. Zod schema: `z.array(z.enum(['winter', 'spring', 'summer', 'autumn']))`. UI: chip multi-select.

**Rationale:** Simple, no join table needed. Four fixed values unlikely to change.

### 6. Start/end points as PostGIS geography columns

**Choice:** Add `start_point` and `end_point` as nullable `geography(Point, 4326)` columns, same type as existing `goal`. If `end_point` is null, UI displays start_point as both start and end (round trip).

**Rationale:** Consistent with existing `goal` column. Enables future distance calculations.

### 7. Description field — plain text with URL detection

**Choice:** Store as `text`. Render in UI with auto-linked URLs (regex detection, render as `<a>` tags). No rich text editor.

**Alternatives considered:**

- Markdown with rendered preview — adds markdown parser dependency, complex for mobile
- Rich text editor (Tiptap/ProseMirror) — heavy dependency for a notes field

**Rationale:** Issue says "free text with hyperlink support." Auto-linking URLs is the simplest approach that satisfies this. Keeps storage simple and avoids XSS from HTML storage.

### 8. Database migration strategy

**Choice:** Add new columns to existing `tours` table with `ALTER TABLE ADD COLUMN ... DEFAULT NULL`. Update `tours_view` to include new columns. Create new RPC `create_tour_full` or update existing `create_tour_with_partners` to accept new parameters (with defaults).

**Rationale:** All new columns are nullable, so no backfill needed. Existing tours unaffected. View update is additive.

### 9. Tour creation dialog — scrollable form with sections

**Choice:** Group fields into collapsible/scrollable sections: Essential (type, name, date), Location (auto-elevation, start/end points), Details (description, season, equipment, notes, GPX), Partners. Dialog becomes a full-screen sheet on mobile for space.

**Rationale:** Many optional fields need organization. Full-screen on mobile prevents cramped UI. Desktop keeps centered dialog with scroll.

## Risks / Trade-offs

- **Swisstopo API availability** → Graceful fallback to manual entry. Non-blocking calls with timeout (5s). Cache results for same coordinates during session.
- **GPX file size** → 2MB client-side limit. GeoJSON in `jsonb` could be large for complex tracks → consider simplifying track (reducing point density) before storage if > 1MB GeoJSON.
- **Supabase free tier row size** → GeoJSON tracks + description could push row size. Monitor. Mitigation: move GPX to separate table with FK if needed.
- **Form complexity on mobile** → Many fields can overwhelm. Mitigation: clear section grouping, optional fields visually de-emphasized, progressive disclosure.
- **Swisstopo API only covers Switzerland** → Elevation/name lookup will return empty for locations outside Swiss borders. UI must handle gracefully (show "elevation unavailable" or similar).

## Open Questions

- Should `create_tour_with_partners` RPC be extended or replaced with a new RPC? Depends on whether backend migration can modify existing function signature without breaking.
- Exact Swisstopo search API endpoint for reverse geocoding named features — needs verification of response format and reliability for alpine POIs.
- Should GPX track simplification happen client-side before upload, or store full resolution? Depends on typical GPX file sizes users will upload.
