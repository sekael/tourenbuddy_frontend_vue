# Tasks

## 1. Git Setup

- [x] 1.1 Create `feat/348-349-map-first-multi-day-creation` from local `main` (no ssh for `git fetch` in the container)

## 2. Planner

- [x] 2.1 `use-location-search.ts` shared by `location-picker.vue` and the planner
- [x] 2.2 `route-planner.vue`: steps, taps, drag, search, lookups, climb/descent, actions
- [x] 2.3 Map store `previewStages`; draft stages drawn in `tourenbuddy-map.vue` / marker layer

## 3. Form and stages

- [x] 3.1 `PointPick.elevation`, list picks, `route()` / `snapshot()` / `collect()` in `tour-form.vue`; "+ Next day" and "Split into daily stages"
- [x] 3.2 `nextSegmentSeed` in `outing.ts` takes a stage draft too
- [x] 3.3 `tour-creation-dialog.vue`: stages strip, mounted forms, side drawer on desktop, save all
- [x] 3.4 `map-page.vue`: creation state, planner flows (new, segment, next day, adjust, split), multi-stage save
- [x] 3.5 Tour detail: "Split into daily stages" for a saved multi-day tour

## 4. Finish

- [x] 4.1 Locales (`en.json`, `de-CH.json`), `npm run check:locales`
- [x] 4.2 Tests: stage seed, planner, form, dialog, map page; `npm run test`, `npx eslint . --fix`, `npm run type-check`
- [x] 4.3 Persona review loop (athlete + guide) until PASS

## 5. Refinement (route = track, days in the route step)

- [x] 5.1 `use-leg-router.ts` shared by drawer and planner; planner follows the ways, follow switch (D8)
- [x] 5.2 Route plan carries the track; form takes it as a drawing; drawer seeded with the route's stops; form points follow the track's stops (D9)
- [x] 5.3 Day pills and "Next day" in the planner, days switch without closing (D10)
- [x] 5.4 Shared fields and dates follow across days in `tour-creation-dialog.vue` (D11)
- [x] 5.5 Stage tabs and remove-day at the form's end (D12)
- [x] 5.6 Locales, tests, lint, type-check
- [x] 5.7 Athlete review loop until PASS
