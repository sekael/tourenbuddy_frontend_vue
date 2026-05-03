## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/61-gpx-track-storage`

## 2. Supabase: Storage + Schema (single migration)

- [x] 2.1 Create private `tour-gpx` bucket
- [x] 2.2 `ALTER TABLE tours DROP COLUMN gpx_track, ADD COLUMN gpx_filepath text NULL`
- [x] 2.3 SQL helper `tour_id_from_gpx_path(text) returns uuid` extracting UUID from `${tourId}.gpx`
- [x] 2.4 RLS policies on `storage.objects` for `bucket_id = 'tour-gpx'` (SELECT/INSERT/UPDATE/DELETE), each authorised by `EXISTS (SELECT 1 FROM tours t WHERE t.id = tour_id_from_gpx_path(name) AND t.user_id = auth.uid())` — structured to be extended later for shared/public tours without path changes
- [x] 2.5 `AFTER DELETE ON tours` trigger function (SECURITY DEFINER) deletes the Storage object referenced by `OLD.gpx_filepath`
- [x] 2.6 Update RPCs `create_tour_full` and `update_tour_full`: replace `p_gpx_track jsonb` with `p_gpx_filepath text`
- [ ] 2.7 Verify migration applies cleanly on a fresh local Supabase instance

## 3. Domain + Data Layer

- [x] 3.1 `src/features/tours/domain/entities/tour.ts`: replace `gpxTrack: GeoJSON.FeatureCollection | null` with `gpxFilepath: string | null` on `Tour` and `TourDraft`
- [x] 3.2 `src/features/tours/data/models/tour-schema.ts`: update Zod schema (`gpx_filepath` row → `gpxFilepath` domain)
- [x] 3.3 New service `src/features/tours/data/services/gpx-storage-service.ts`: `uploadGpx(tourId, file)`, `removeGpx(tourId)`, `getSignedUrl(filepath)`, `downloadOriginal(filepath, fallbackName)`
- [x] 3.4 `src/features/tours/data/repositories/tours-repository-impl.ts`: pass `gpxFilepath` through RPCs; on `deleteTour`, call `removeGpx` (best-effort, log on failure since trigger is fallback)
- [x] 3.5 New util `src/core/utils/color.ts`: `darkenHex(hex, percent)` HSL helper (small, well-tested)
- [x] 3.6 `src/features/tours/data/models/tour-type.ts`: add `TOUR_TYPE_TRACK_COLORS` map — darker (~18%) variant of each `TOUR_TYPE_COLORS` entry, committed as literal hex values

## 4. Presentation: Tours Store + Form + Info Sheet

- [x] 4.1 `tours-store.ts`: extend `createTourFromDraft` to upload file post-insert and patch `gpx_filepath`; surface non-fatal upload warnings via existing error ref
- [x] 4.2 `tours-store.ts`: extend `updateTour` for replace (overwrite same key) and remove (delete + null filepath) cases
- [x] 4.3 `tours-store.ts`: extend `deleteTour` to remove Storage object alongside row delete
- [x] 4.4 `tour-form.vue`: replace `gpxTrack` GeoJSON state with `gpxFile: File | null`; emit File on submit; keep parse-validation step for fast UX feedback
- [x] 4.5 `tour-form.vue`: redesign GPX block with design tokens — empty / filled (chip + replace + remove + track-color swatch) / uploading / error states; ≥44 px tap targets
- [x] 4.6 `tour-creation-dialog.vue`: pass File through; show submission spinner while upload in flight
- [x] 4.7 `tour-info-sheet.vue`: when `gpxFilepath` set, render a "Download GPX" button that calls `downloadOriginal`; hide when null
- [ ] 4.8 Verify mobile bottom-sheet and desktop dialog layouts via `adaptive-overlay`

## 5. Map Layer Color + Lazy Load

- [x] 5.1 New composable `src/features/map/presentation/composables/use-gpx-cache.ts`: in-memory LRU `Map<tourId, FeatureCollection>` (cap 10)
- [x] 5.2 `gpx-track-layer.ts`: paint `line-color` becomes `match` expression over `TOUR_TYPE_TRACK_COLORS` with explicit fallback
- [x] 5.3 `gpx-track-layer.ts`: `updateTrack(tour)` now async — null tour clears source; tour with `gpxFilepath` checks cache → else fetch via signed URL → parse → inject `tourType` into each feature → cache → `setData`
- [x] 5.4 `map-page.vue`: pass current tour (not just id) to layer; route async errors through logger
- [x] 5.5 Unit-verify track color is darker than marker color for every tour type

## 6. PWA Caching

- [x] 6.1 `vite.config.ts`: add Workbox runtime cache rule matching the Supabase Storage `tour-gpx` URL pattern → `StaleWhileRevalidate`, 100 entries, 30-day expiry

## 7. Internationalisation

- [x] 7.1 Add keys to `src/locales/en.json` and `src/locales/de-CH.json` under `tours.form`: `gpxLabel`, `gpxUploadBtn`, `gpxReplaceBtn`, `gpxRemoveBtn`, `gpxUploading`, `gpxUploadFailed`, `gpxRetry`; verify existing `gpxTooLarge`, `gpxInvalid`, `gpxReadError`
- [x] 7.2 Add `tours.infoSheet.downloadGpxBtn` to both locales
- [x] 7.3 Replace inline strings in `tour-form.vue` and `tour-info-sheet.vue` with `t(...)` calls

## 8. Tests

- [x] 8.1 Unit: `gpx-storage-service` — upload, remove, signed URL, download (mock Supabase client); failure cases
- [x] 8.2 Unit: tours-repository-impl — `gpxFilepath` round-trip, delete cascades remove
- [x] 8.3 Component: `tour-form.vue` — empty/filled/uploading/error states; remove + replace flows
- [x] 8.4 Component: `tour-info-sheet.vue` — download button visibility + click triggers download
- [x] 8.5 Unit: `gpx-track-layer` color expression contains every `TOUR_TYPE_TRACK_COLORS` key + fallback; track color darker than marker color per type
- [x] 8.6 Unit: `use-gpx-cache` hit/miss + LRU eviction
- [x] 8.7 Unit: `darkenHex` correctness for representative inputs
- [x] 8.8 Skip happy-path-only tests; cover failures (parse error, upload reject, signed URL 403, missing tour type)

## 9. Finalize

- [x] 9.1 Run `npm run type-check && npx eslint . --fix && npm run format && npm run test` — all green
- [ ] 9.2 Manual QA mobile: create / edit (replace + remove) / delete; verify track color darker than marker; download original; offline reload still renders cached track
- [ ] 9.3 Manual QA desktop: same matrix
- [x] 9.4 Prompt user to commit with conventional message (e.g., `feat(tours): store GPX in Supabase Storage with type-colored tracks (#61)`); do NOT run `git commit`
- [x] 9.5 Prompt user to push branch and open PR linking issue #61
