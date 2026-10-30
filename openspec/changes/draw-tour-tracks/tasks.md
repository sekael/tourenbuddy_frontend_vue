# Tasks

## 1. Git Setup

- [x] 1.1 Create `feat/323-draw-tour-tracks` from local `main` (container has no ssh for `git fetch`) and verify with `git branch --show-current`

## 2. Routing core

- [x] 2.1 `map/domain/track-routing.ts`: network units, graph with vertex/segment joins, snapping, A*; verify joins (T-junction, tile cut), no-way, cost preference and same-segment in `track-routing.test.ts`
- [x] 2.2 `map/domain/drawn-track.ts` (line of a drawing, drawing from a line) and `snap-network.ts` (layers + activity rule); verify in their tests
- [x] 2.3 `map/data/services/trail-network-service.ts`: zoom-13 base and ski tiles → network lines, tile cache, too-far and unavailable errors; add `@mapbox/vector-tile` and `pbf` as direct dependencies

## 3. Heights and GPX

- [x] 3.1 `tours/data/services/swisstopo-profile-service.ts`: densify, POST profile, shared answers; verify failure and densify in its test
- [x] 3.2 `tours/data/services/gpx-writer.ts`; verify escaping and missing heights round-trip through the parser
- [x] 3.3 `estimatedMinutes` (SAC rule, ski pace) in `route-metrics.ts`; verify in `route-metrics.test.ts`

## 4. Drawing UI

- [x] 4.1 `use-track-drawing.ts`: queue, legs, drag/drop, undo/redo, live profile and numbers; verify straight, unavailable and snap+undo in its test
- [x] 4.2 `track-draw-layer.ts`, `elevation-profile.vue`, `track-draw-panel.vue`, `track-drawer.vue` (gestures, layer toggles, framing a seed); icons `draw`, `undo`, `redo`
- [x] 4.3 Map store `isDrawingTrack` / `previewTrack`; map page wiring for create and edit; marker taps ignored while drawing; saved track hidden and draft track drawn in `tourenbuddy-map.vue`

## 5. Form and plan as tour

- [x] 5.1 Tour form: track section after the activity, "Draw on map" / "Edit on map", drawn track → GPX through the pick path, Save blocked while heights load, `trackChange`; creation dialog and info sheet pass-through; verify in `tour-form.test.ts`
- [x] 5.2 `planFromRoute` returns the route line as track (`routeLine`); verify variant and disconnected parts in `plan-from-route.test.ts`
- [x] 5.3 Locale keys in `en.json` + `de-CH.json`; `npm run check:locales`

## 6. Verification

- [x] 6.1 `npx eslint . --fix`, `npx eslint`, `npm run type-check`, `npm run test`
- [x] 6.2 Headless walk: draw on a phone (hiking) and desktop (ski route planned as tour), edit a saved track, drag, undo; save and see route numbers
- [x] 6.3 Persona review loop (`.review/`) until every goal passes

## 7. Owner follow-ups

- [x] 7.1 Legend out of the layers panel (button only); onboarding copy points at the ⓘ button
- [x] 7.2 Leg handles: pull a leg's middle to insert a snapped point (`dropInsert`), shown on legs ≥ 40 px; test in `use-track-drawing.test.ts`
- [x] 7.3 Drop the too-far / off-network notices (only "trails couldn't load" stays)
- [x] 7.4 "To start" (out-and-back in one step); close (×) moves to the panel's top right; test in `use-track-drawing.test.ts`
- [x] 7.5 Goal pick: tap a marked ski route → its card → plan with track; picker hint; closing returns to the pick
- [x] 7.6 Route numbers from the track only: nothing while it loads, terrain heights for a height-less track; tests in `use-route-metrics.test.ts`
- [x] 7.7 Persona review round on the follow-ups
- [x] 7.8 Round 3 findings: loose way ends bridge data gaps ≤ 30 m (test in `track-routing.test.ts`); desktop drawing panel docked left
- [x] 7.9 Plan as tour: start and end from the route's loose ends by terrain height vs SAC's climb and descent (traverses keep their descent); test in `plan-from-route.test.ts`; checked on 150 real routes
- [x] 7.10 Toasts and chips rise above the location picker's dock (`--dock-inset`)
- [x] 7.11 An exact copy of an own tour opens the existing one with a notice (`dropIfDuplicate`); drawn tracks densified with or without heights; tests in `tours-store.test.ts`, `tour-form.test.ts`
- [x] 7.12 Headless walk: route error while picking (above the dock), Eggerhorn planned twice (Binn → Ausserbinn, one tour)
