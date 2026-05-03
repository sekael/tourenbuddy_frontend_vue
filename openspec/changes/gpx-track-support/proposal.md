## Why

Tours currently embed parsed GPX as inline GeoJSON in a Postgres column. This bloats DB rows, loses the original `.gpx` file (needed for export/re-share), and the rendered track is hardcoded orange regardless of tour type. Issue #61 asks for proper file storage, type-colored tracks, and cascade deletion across upload/edit/delete flows on both mobile and desktop. The storage layout must also be forward-compatible with planned tour sharing and public-tour features without future migrations.

## What Changes

- Replace inline `gpx_track` JSONB column with `gpx_filepath text` (storage object key). Atomic flip — no dual-write, no GPX rows currently exist in production.
- Add `tour-gpx` private Storage bucket. **Object key = `${tourId}.gpx`** (tour-id-rooted, owner-agnostic) so RLS can evolve from "owner only" to "owner + shared-with + public" by changing the policy alone, not the path layout.
- RLS policies on `storage.objects` join to `tours` via the path-derived tour id and authorise based on the tour row's owner (today) or its future visibility/sharing columns (later).
- DB trigger on `tours` delete removes the Storage object as a safety net.
- Tour create form uploads the `.gpx` to Storage after parse-validation. Edit form supports replace and remove actions.
- Map gpx-track layer fetches + parses the file lazily when a tour is selected, caches per-session, and renders the polyline using a **darker variant** of the tour-type color (new `TOUR_TYPE_TRACK_COLORS` map), keeping the marker visually distinct from its track.
- Tour deletion (and explicit "remove track" action) deletes the Storage object; trigger is fallback.
- Tour info sheet exposes a **Download original GPX** action that streams the file via signed URL.
- Mobile (bottom-sheet) and desktop (dialog/drawer) get a unified GPX field block: upload → filename chip → replace/remove, with progress + error states.
- New i18n keys for upload/replace/remove/download/error states in `en.json` + `de-CH.json`.

## Capabilities

### New Capabilities
- `gpx-tracks`: Upload, store, retrieve, render, and delete tour GPX tracks via Supabase Storage with tour-type-colored map rendering.

### Modified Capabilities
<!-- No existing OpenSpec specs to modify. -->

## Impact

- **DB**: replace `tours.gpx_track jsonb` with `tours.gpx_filepath text`; updates to RPCs `create_tour_full` and `update_tour_full`; new `AFTER DELETE` trigger on `tours` removing Storage object.
- **Storage**: new `tour-gpx` bucket + RLS policies that resolve path → tour id and authorise via the `tours` row (owner today; ready for visibility/sharing columns later).
- **Frontend**:
  - `features/tours/data/repositories/tours-repository-impl.ts` (upload/delete + filepath passthrough)
  - `features/tours/data/services/gpx-storage-service.ts` (new — upload/remove/signed URL/download)
  - `features/tours/data/services/gpx-parser.ts` (unchanged signature)
  - `features/tours/domain/entities/tour.ts` (`gpxTrack` → `gpxFilepath`)
  - `features/tours/data/models/tour-schema.ts` (Zod)
  - `features/tours/data/models/tour-type.ts` (new `TOUR_TYPE_TRACK_COLORS` darker palette)
  - `features/tours/presentation/components/tour-form.vue` (upload/replace/remove UX)
  - `features/tours/presentation/components/tour-info-sheet.vue` (download original button)
  - `features/tours/presentation/stores/tours-store.ts` (orchestrate upload/delete)
  - `features/map/presentation/components/gpx-track-layer.ts` (darker-color expression, lazy fetch+parse)
  - `features/map/presentation/pages/map-page.vue` (pass tour for color)
  - `locales/en.json`, `locales/de-CH.json`
- **Tests**: storage service + repo upload/delete; tour-form states; info-sheet download; layer color expression.
- **PWA**: runtime cache rule for Storage GETs of `.gpx` files (`StaleWhileRevalidate`).
- **Constraint**: 2 MB client-side cap stays.
