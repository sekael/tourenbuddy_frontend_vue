# Tasks

## 1. Git Setup

- [x] 1.1 Create branch from latest `main` (`git fetch origin && git checkout main && git pull && git checkout -b feat/339-340-location-search-tour-details`) and verify `git rev-parse HEAD` equals `origin/main`

## 2. Location search service (D1–D3)

- [x] 2.1 Add `src/features/map/data/services/swisstopo-search-service.ts`: `searchLocations(query, lang, signal)` calling GeoAdmin `SearchServer` (origins `gazetteer,zipcode,gg25,address`, `sr=4326`, `limit=30`, 5 s timeout), Zod-validated response, `DOMParser` label split into `name`/`kind`/`region`, origin→zoom table; verify by type-check
- [x] 2.2 Add pure `rankResults(results, center, zoom)` (D3b: duplicate-name groups nearest-first from z9, API order otherwise, cap 8); verify with tests in 2.3
- [x] 2.3 Add `test/features/map/data/services/swisstopo-search-service.test.ts` covering: label with entities/markup → plain text, malformed entries dropped, non-OK response and abort → error/empty handling, unknown origin → default zoom, ranking: duplicates reordered only at z ≥ 9, distinct names never reordered, nearby duplicate beyond position 8 surfaces; verify `npx vitest run test/features/map/data/services/swisstopo-search-service.test.ts` passes

## 3. Search in the location picker (D4, D5)

- [x] 3.0 Extract the tour list `search-row` into `src/core/components/search-input.vue` (v-model, clear, `enter`/`escape` emits) and switch `tour-list-sheet.vue` to it; verify the existing tour-list-sheet tests still pass and the list search looks unchanged
- [x] 3.1 Extend `location-picker.vue` with the search field + result list (debounced ≥ 2 chars, abort superseded requests — **gap for the user: query/debounce/abort/stale-response logic, `TODO(me)` marker; aborted requests must not surface as errors**, empty/error states, hidden when `isOnline` is false); choosing a result moves the camera with zero padding (`flyTo`, `jumpTo` under reduced motion) and closes the list; verify manually that the crosshair lands on the chosen summit
- [x] 3.2 Emit `confirm({ lng, lat, name? })`, setting `name` only when the last chosen result is within 50 m of the crosshair; verify via test 3.4
- [x] 3.3 In `map-page.vue`, use `location.name ?? await suggestTourName(location)` at every name-lookup site (initial goal, goal re-pick, start, end, edit pick); verify creating a tour via search prefills the name
- [x] 3.4 In `tour-form.vue`, make the `initialName` watcher overwrite only when the name is empty or equals the last auto-filled value; verify with a `tour-form` test (typed name survives re-pick, auto name is replaced)
- [x] 3.5 Extend `test/features/map/presentation/components/location-picker.test.ts`: < 2 chars sends no request, stale response ignored, offline hides the field, Enter chooses first result, map touch / Escape close the list without moving, clearing forgets the chosen result, choosing a result leaves `previewGoal` untouched, confirm after > 50 m pan omits `name`, confirm on result includes it; verify the file passes
- [x] 3.6 Add i18n keys (search placeholder, no results, error, field aria-label) to `en.json` and `de-CH.json`; verify `npm run check:locales` passes
- [x] 3.7 Bottom dock (D4b): results, frosted pill field with clear button and Cancel/Confirm in one fixed bottom dock; `useVisualViewportInsets` lifts it onto the on-screen keyboard and hides the actions meanwhile; verify picker tests (keyboard, jitter/zoom, clear) and screenshots on desktop (header uncovered), mobile, mobile with simulated keyboard

## 4. Ski-touring icons (D7)

- [x] 4.1 Add `customCollections` (`FileSystemIconLoader('./src/assets/icons')`) to `vite.config.ts`; draw `src/assets/icons/ski-touring.svg` and `splitboarding.svg` (24×24, `currentColor`); verify `npm run build` resolves `~icons/tb/*`
- [x] 4.2 Register both in `src/core/components/icons.ts`, point `TOUR_TYPE_ICONS.skitour`/`.splitboarding` at them; verify a screenshot of both next to `downhill_skiing`/`snowboarding` at sm/md/lg and get user sign-off
- [x] 4.3 Update the icon how-to in `.claude/conventions.md` (Fonts & icons) with the custom-glyph path; verify the documented import path matches 4.1

## 5. Compact tour detail (D6)

- [x] 5.0 Seed one tour per detail-view variant in `supabase/seed.sql` (user Lena, tours `…10`–`…14`; owner view as Lena, friend view as Patrick); verified in a rolled-back transaction: rows readable through `tours_view` / `friend_tours_view` as intended, block idempotent, all pgTAP suites green on a pristine seed with and without it
- [x] 5.1 Create `tour-fact-rows.vue` (type, Start, End, `partners` slot, seasons, description with links, equipment, notes; inline "Start"/"End" labels, `aria-label` per row, empty rows omitted); verify with a new `test/features/tours/presentation/components/tour-fact-rows.test.ts` covering minimal tour (type only), one-way and round-trip end, no-label text rows
- [x] 5.2 Rewrite the hero in `tour-info-sheet.vue` as the two-line block (D6): line 1 badge + goal elevation headline + toggles, line 2 `date · coords` with `month: 'short'` range, owner line for friend tours, date moves up when elevation is missing; completion/visibility as `BaseIconButton` toggles with `aria-pressed` + a fixed state `aria-label` ("Completed", "Private"); delete the owner-toggles row, section headings, `fact-grid`, `detail-card` and their styles; verify desktop drawer and mobile sheet visually against every seeded showcase tour (5.0)
- [x] 5.3 Update `test/features/tours/presentation/components/tour-info-sheet.test.ts` selectors; add cases for the toggle's accessible label/pressed state (rollback is covered in `tours-store.test.ts`), missing-elevation fallback and friend-tour owner line; verify the file passes
- [x] 5.4 Add/adjust i18n keys (Start/End inline labels, toggle aria-labels) in both locales; verify `npm run check:locales` passes
- [x] 5.5 Keep the owner-toggles row (labelled tonal buttons below the hero, as before this change) after user review: hero icon toggles and a checkbox chip did not read as "complete"/"make private"; restore `completeTourBtn`/`visibilityMake*` keys and `radio_button_unchecked`; verify info-sheet tests and screenshots

## 6. Non-blocking Swisstopo lookups (D8)

- [x] 6.1 Both services take an optional caller `signal` (manual link), return `null` silently on a caller abort, and time out after 10 s; verify service tests (caller abort, nothing settles before 10 s)
- [x] 6.2 Add `useSwisstopoFill(field)` (loading/failed status, abort on `input`, typed value skipped by later picks, stale check) and a `pick` prop on `TourForm` replacing `initialName`/`initialElevation`/`initialStartPoint`/`initialEndPoint`/`initial*PointMeta`; the six name/elevation inputs show the spinner and status placeholder; removing a start/end point aborts its lookups; verify `tour-form` tests (name fills while elevation loads, typing cancels and wins, re-pick skips typed field, failure placeholder, superseded pick, search name, seeded form looks nothing up, removed point) and that each guard fails a mutation
- [x] 6.3 `map-page.vue` and `tour-info-sheet.vue` hand over `{ type, location, name? }` and open the form without awaiting; suggest mode seeds a proposed goal's elevation through the seed draft; verify map-page and info-sheet tests
- [x] 6.4 Add `tours.form.swisstopo.loading` / `.failed` to both locales; verify `npm run check:locales`

## 7. Grouped detail and climbing/mountaineering icons (D6, D7 follow-ups)

- [x] 7.1 `TourFactRows` renders activity / route (with a `route` slot for the GPX download) / partners / free-text groups, each omitted when empty and led by a divider; the sheet gives the attachments strip (single root) and the suggestions the same divider; verify `tour-fact-rows` (empty groups left out, GPX in the route group) and info-sheet tests
- [x] 7.2 Add `climbing.svg` (climber under an overhang) and `mountaineering.svg` (Temaki scrambling pictogram, CC0), register both and point `TOUR_TYPE_ICONS` at them; verify `tour-type` test (every type icon is registered) and a side-by-side render with the other type icons
- [x] 7.3 Probe the Swisstopo height API for the 503s and record the finding under Risks

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix`, then `npx eslint` with zero warnings, `npm run type-check` and `npm run test`; verify all pass
- [ ] 8.2 After `supabase db reset`, walk the app once (as Lena and as Patrick): add a tour via search (goal + start), edit a tour's end via search, toggle complete/private in the owner toggles row, go offline in the picker; with Swisstopo throttled (devtools), check the spinner and the manual-entry placeholder in name and elevation, and that typing during a load keeps the typed value; check the grouped detail and the climbing/mountaineering icons in the type picker; verify each matches the specs
- [ ] 8.3 Prompt the user to commit with a ready-to-copy message, e.g. `feat(tours): location search in picker and compact tour details (#339, #340)`
- [ ] 8.4 Prompt the user to push and open a PR titled with the highest-impact type (`feat(tours): …`), body referencing `Closes #339` and `Closes #340`

## Workflow follow-up

- Archive the change with `openspec-archive` after the PR is merged.
