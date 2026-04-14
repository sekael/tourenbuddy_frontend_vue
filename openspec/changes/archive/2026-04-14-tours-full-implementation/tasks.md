## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/19-tours-full-implementation`

## 2. Database & Backend

- [x] 2.1 Write SQL migration to add new columns to `tours` table: `tour_type` (text, nullable), `elevation` (numeric, nullable), `gpx_track` (jsonb, nullable), `description` (text, nullable), `seasons` (text[], nullable), `start_point` (geography(Point,4326), nullable), `end_point` (geography(Point,4326), nullable), `equipment` (text, nullable), `notes` (text, nullable)
- [x] 2.2 Update `tours_view` to include all new columns (with `start_lon`/`start_lat`/`end_lon`/`end_lat` extracted from geography points)
- [x] 2.3 Update `create_tour_with_partners` RPC (or create `create_tour_full`) to accept all new parameters with null defaults

## 3. Tour Type Enum & Extended Schema

- [x] 3.1 Create `tour-type.ts` with Zod enum for tour types and human-readable label map
- [x] 3.2 Create `season.ts` with Zod enum for seasons and label map
- [x] 3.3 Update `tour-schema.ts`: expand `tourRowSchema` with new snake_case fields and transforms; expand `tourSchema` with new camelCase fields
- [x] 3.4 Update `tour.ts`: expand `TourDraft` interface with all new optional fields

## 4. Swisstopo API Services

- [x] 4.1 Create `wgs84-to-lv95.ts` in `src/core/utils/` — pure-math WGS84→LV95 (EPSG:4326→EPSG:2056) coordinate transformation using swisstopo approximate polynomial formulas. No external library.
- [x] 4.2 Write unit tests for `wgs84ToLv95` with known reference points (e.g., Bern Federal Palace ≈ E2600000/N1200000, ±2m)
- [x] 4.3 Create `swisstopo-elevation-service.ts` in `src/features/tours/data/services/` — convert WGS84 to LV95 via `wgs84ToLv95`, then GET elevation from `api3.geo.admin.ch/rest/services/height?easting={E}&northing={N}&sr=2056`, 5s timeout, null on failure
- [x] 4.4 Create `swisstopo-name-service.ts` in `src/features/tours/data/services/` — reverse geocode from `api3.geo.admin.ch/rest/services/api/SearchServer`, 5s timeout, null on failure
- [x] 4.5 Write unit tests for both Swisstopo services (mock fetch, test success/failure/timeout paths)

## 5. GPX Parsing

- [x] 5.1 Install `@tmcw/togeojson` dependency
- [x] 5.2 Create `gpx-parser.ts` in `src/features/tours/data/services/` — parse GPX File to GeoJSON FeatureCollection, validate size (2MB limit), handle parse errors
- [x] 5.3 Write unit tests for GPX parser (valid GPX, invalid file, oversized file)

## 6. Repository & Store Updates

- [x] 6.1 Update `tours-repository.ts` interface with new field parameters on create method
- [x] 6.2 Update `ToursRepositoryImpl` to pass all new fields to RPC (tour_type, elevation, gpx_track, description, seasons, start_point as WKT, end_point as WKT, equipment, notes)
- [x] 6.3 Update `tours-store.ts` `createTourFromDraft` to pass extended draft fields
- [x] 6.4 Write/update unit tests for repository and store

## 7. Tour Creation Dialog (Extended)

- [x] 7.1 Add tour type chip selector to dialog (horizontal scrollable chip row)
- [x] 7.2 Add elevation number input with auto-fill indicator icon
- [x] 7.3 Add season multi-select chips (Winter, Spring, Summer, Autumn)
- [x] 7.4 Add description textarea
- [x] 7.5 Add equipment textarea
- [x] 7.6 Add notes textarea
- [x] 7.7 Add GPX file upload button with filename display and remove action
- [x] 7.8 Add start/end point picker controls (coordinate display + pick button triggering location picker)
- [x] 7.9 Organize fields into logical sections with labels; make dialog full-screen on mobile, scrollable centered dialog on desktop
- [x] 7.10 Wire Swisstopo elevation + name auto-fill: fire both lookups after location confirm, pre-populate fields before dialog opens

## 8. Tour Info Sheet (Extended)

- [x] 8.1 Add tour type row with activity icon and label
- [x] 8.2 Add elevation row with `landscape` icon, formatted with thousands separator and "m" unit
- [x] 8.3 Add description section with auto-linked URLs (regex URL detection → `<a>` tags, `target="_blank"`, `rel="noopener noreferrer"`)
- [x] 8.4 Add season tags as colored chips
- [x] 8.5 Add start/end point rows with `trip_origin` / `flag` icons; show "Round trip" when end point absent
- [x] 8.6 Add equipment row with `backpack` icon
- [x] 8.7 Add notes row with `sticky_note_2` icon
- [x] 8.8 Add GPX track indicator with `route` icon
- [x] 8.9 Ensure adaptive layout: only show sections with data, consistent spacing for any field combination

## 9. GPX Map Layer

- [x] 9.1 Create GPX polyline layer module (GeoJSON source + line layer in MapLibre) — add/remove based on selected tour's `gpxTrack`
- [x] 9.2 Wire layer to map store: show track when tour with GPX selected, remove on deselect
- [x] 9.3 Style polyline (color, width, opacity) consistent with app theme

## 10. Integration & Testing

- [x] 10.1 End-to-end test: create tour with all fields populated, verify info sheet displays all
- [x] 10.2 Test: create tour with minimal fields (only location), verify no empty sections shown
- [x] 10.3 Test: GPX upload → map polyline appears on tour select
- [x] 10.4 Test: elevation + name auto-fill fires on location confirm
- [x] 10.5 Verify existing tours (legacy schema) still load and display correctly

## 11. Finalize

- [x] 11.1 Run `npm run lint` and `npm run format` — fix any issues
- [x] 11.2 Run `npm run type-check` — fix any type errors
- [x] 11.3 Run `npm run test` — all tests pass
- [x] 11.4 Prompt user to commit with message: `feat(tours): expand tour model with type, elevation, GPX, description, seasons, start/end points, equipment, notes (#19)`
- [x] 11.5 Prompt user to push branch and create PR
