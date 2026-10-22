# Tasks

## 1. Git Setup

- [x] 1.1 Create the feature branch from latest `main` (`git fetch origin && git checkout main && git pull && git checkout -b feat/335-multiple-activity-types`; `git fetch` has no ssh in the container → branched from local `main`) — verify with `git branch --show-current`

## 2. Database

- [x] 2.1 New migration `multi_activity_tours`: add `tour_types text[] not null default '{}'`, backfill from `tour_type`, CHECK `tour_types <@ allowed`, drop + recreate `tours_view` / `friend_tours_view` (with compat `tour_types[1] as tour_type`, `security_invoker`, select-only grants), drop `tour_type` — verify by applying it in a rolled-back transaction on the local DB
- [x] 2.2 Re-create `create_tour_full` / `update_tour_full` with trailing `p_tour_types text[]` and the compat `p_tour_type` rule (D2), re-grant EXECUTE to `authenticated` — verify old-style and new-style calls in a rolled-back transaction
- [x] 2.3 Rewrite collision predicate, scans, backfill lists, eviction / void triggers and meaningful-change check to `tour_types` with overlap semantics (D4) — verify: hike vs ski+hike collide, adding a type keeps a link, removing the shared type evicts
- [x] 2.4 Suggestions: `tour_field_value` / `fn_apply_tour_suggestion` on lists (scalar tolerated), convert existing `tour_type` row values to arrays (D5) — verify accept of an array suggestion on the local DB
- [x] 2.5 Update `supabase/seed.sql` (incl. one multi-activity tour) and `supabase/tests/notifications_rls.sql` — verify pgTAP suites pass against the migrated local DB (pristine-seed harness)
- [x] 2.6 Apply the migration to the local DB (`supabase migration up --db-url …?sslmode=disable`) — verify `select tour_types from tours` returns arrays

## 3. Domain, data and store

- [x] 3.1 `tourTypes: TourType[]` in row schemas (`tour_types`), `tourSchema`, `TourDraft`; repository sends `p_tour_types` — verify `tour.test.ts` / repository tests
- [x] 3.2 `withTourTypes()` legacy lift applied on tours / friend-tours cache hydrate and tour replay (D3) — verify unit test with a legacy snapshot and a legacy queued draft
- [x] 3.3 `sharesActivity()` in `domain/collision.ts`; info-sheet `wouldEvict` / `pendingRequestsBrokenBy` and `collision-notice` use it — verify unit tests for overlap / no-overlap / untyped

## 4. Form, filters and display

- [x] 4.1 Multi-select activity chips in `tour-form.vue` in canonical order; emit `tourTypesChange` and feed `previewTourTypes` in the map store — verify `tour-form.test.ts`
- [x] 4.2 Activity filter matches any type — verify `use-tour-filters.test.ts` multi-type case
- [x] 4.3 Fact rows list every type; list avatar, hero badge/tint, calendar components use the primary type; suggestion diff + row handle lists — verify component tests

## 5. Map rendering

- [x] 5.1 Pie overlay symbol layers + on-demand `pie:` images; transparent circle fill for split features; `pieKey` on tours, detail and preview features (D6) — verify in the running app: ski+hike tour shows a blue/red split, selected keeps the white ring
- [x] 5.2 Cluster pies weighted per colour; spiderfy / tween dots split via `conic-gradient` (D7) — verify `pie-marker` tests and a mixed cluster in the app
- [x] 5.3 GPX `line-gradient` bands with fades for multi-colour tours (D8) — verify gradient helper unit test and a ski+hike track in the app

## 6. Release note

- [x] 6.1 Append `2026-10-multi-activity-search` to `RELEASE_NOTES` with `en` + `de-CH` copy (multi-activity, location search, compact detail) — verify `npm run check:locales` and the release-note tests
- [x] 6.2 Check the onboarding guided tour copy/targets still match the activity picker — verify by reading `onboarding-steps.ts` + step copy

## 7. Verify

- [x] 7.1 `npx eslint . --fix`, `npx eslint` (zero warnings), `npm run type-check`, `npm run test` all pass
- [x] 7.2 Walk the app against the local DB: give a tour two activities, see split marker + cluster + track, filter by one of its types (linked-tour type edits verified by `supabase/tests/tour_types.sql`, not clicked through)

## 8. Outings: database (#338)

- [x] 8.1 New migration `tour_outings`: `outing_id` / `outing_name` / `outing_position` on `tours` with CHECKs + partial index; recreate both views with the three columns (`security_invoker`, select-only grants) — verify in a rolled-back transaction
- [x] 8.2 Re-create `create_tour_full` / `update_tour_full` with trailing `p_outing jsonb` (null = keep / standalone, `{}` = standalone, object = segment), re-grant EXECUTE (D12) — verify stale call keeps membership, `{}` clears, bad shape → 23514
- [x] 8.3 pgTAP `supabase/tests/tour_outings.sql` (membership, stale keep, clear, CHECKs, friend view exposure, no partner notification); seed gains one two-segment outing — verify all pgTAP suites against the migrated DB
- [x] 8.4 Apply the migration to the local DB (`supabase migration up --db-url …?sslmode=disable`)

## 9. Outings: domain, data and store

- [x] 9.1 `Tour.outing` / `TourDraft.outing` (undefined = keep), row schemas, repository `p_outing` — verify schema + repository tests
- [x] 9.2 `domain/outing.ts`: key, grouping (owner + id, ≥ 2 segments), order, display name, next position, new-segment seed — verify unit tests
- [x] 9.3 Tours store: `setOuting`, `ensureOuting`, `addToOuting`, `renameOuting`, `reorderSegments`, `removeFromOuting` (dissolve at one; anchor joins first); optimistic apply keeps outing on `undefined` — verify store tests incl. offline queue

## 10. Outings: map

- [x] 10.1 Map store `selectedOutingKey` (exclusive with `selectedTourId`) — verify map-store tests
- [x] 10.2 Marker layer: focused segments pinned out of clustering, white ring, numbered badge images (D16) — verify marker-layer spec
- [x] 10.3 GPX layer: one source/layer per track, generation guard — verify gpx-track-layer tests
- [x] 10.4 Overview framing of all segment points — verify in the running app

## 11. Outings: UI

- [x] 11.1 Outing overview sheet (timeline, owner rename / reorder / remove / add) — verify component test
- [x] 11.2 Segment navigator in the tour detail; back from a segment returns to the overview — verify component test
- [x] 11.3 Add-segment view (new on map / existing standalone tour); seeded creation form; form create mode keyed on `tourId` (D17) — verify form + view tests
- [x] 11.4 List: outing rows on both tabs, search matches outing name (D18) — verify list tests
- [x] 11.5 Map page wiring: overview overlay, marker tap → overview, origins / back — verify map-page tests
- [x] 11.6 Icons, `en` + `de-CH` copy, release note gains the outings highlight — verify `npm run check:locales`
- [x] 11.7 Check the onboarding guided tour still matches (no new step needed) — verify by reading `onboarding-steps.ts`

## 12. Outings: verify

- [x] 12.1 `npx eslint . --fix`, `npx eslint`, `npm run type-check`, `npm run test`, `openspec validate --strict`
- [x] 12.2 Walk the app against the local DB: add a segment to a tour, open the overview from a marker, step through segments, reorder, remove, list row + search; revert walk data

## 12b. Detail colours and map direction

- [x] 12b.1 Hero badge split per activity (diagonal slices, cropped icons); activity chips in their own colour (detail + form); rest of the detail view neutral — verify component tests
- [x] 12b.2 GPX bands denser (`9n`); thin start → goal → end connector in the activity marker colours with evenly spaced arrows for tours without a track; outing overview shows the first start and last end; an open segment shows only itself — verify `gpx-track-layer` + `tour-detail-markers` tests
- [x] 12b.3 Segments as draggable cards (dashed connector between them, amber at a gap; dragged card dims, drop target outlined); drag-handle reorder (one local step, then writes; failure restores); gaps between segments shown as a dashed link, a timeline hint and loose-end markers — verify `outing`, `tours-store`, `outing-overview-sheet`, `gpx-track-layer` tests + walk

## 12c. Planning depth (guide review)

- [x] 12c.1 `domain/route-metrics.ts`: point climb/descent, track distance/climb/descent with 5 m hysteresis, outing totals and days, night stops (D19, D20), plus dates out of order — verify unit tests incl. missing heights, round trip, flat track, no-ele track
- [x] 12c.2 `loadGpxTrack` shared by the map layer and `useRouteMetrics` (one cache, deduped loads) — verify `gpx-track-layer` tests
- [x] 12c.3 Detail route row (climb · descent · distance); overview hero (days · segments, way, totals); segment cards (goal height, climb/descent); night rows between cards (D19, D20) — verify component tests
- [x] 12c.4 Handover rings and dark dashed gap links on the overview map; ring/chequered-flag glyphs on map and detail rows (D21, D22) — verify `tour-detail-markers` tests + walk
- [x] 12c.5 `useHandleReorder` (pointer + keyboard, target by row midpoints, edge auto-scroll) for segments and attachments; editing scrolls the stages into view on a phone; overview sheet fits content while editing/adding (D23) — verify composable + component tests and a touch walk
- [x] 12c.6 `formatElevation` everywhere a height shows (D24) — verify grep for `}m` leftovers
- [x] 12c.7 Independent review of the result (guide, design and code reviewers), fix what holds up — version-keyed track cache, compact outing header, clearer drop target, warning icons

## 13. Finalize

- [x] 13.1 Run lint + format (`npx eslint . --fix`) one last time — verify clean `git diff --stat` of formatting only
- [x] 13.2 Prompt the user to commit with a ready-to-copy conventional commit message (`feat(tours): …`)
- [x] 13.3 Prompt the user to push, open the PR and run `supabase db push` BEFORE merging (migration first, frontend second)

## Workflow follow-up

- Archive with `openspec-archive` after merge.
- Follow-up migration: drop the `p_tour_type` compat argument and the views' `tour_type` column once no pre-#335 build is in the field.
