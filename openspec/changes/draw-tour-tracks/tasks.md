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

## 8. Owner round 4

- [x] 8.1 Snapping on every way: `trail-network-service.ts` caches base lines with a "marked" flag and costs them per mode (D2 table); ski mode loads base and ski tiles; per-line join (`NetworkLine.join`) in `buildNetwork`; no layer → base ways; panel status texts; tests in `trail-network-service.test.ts` (new), `track-routing.test.ts`, `use-track-drawing.test.ts`
- [x] 8.2 Form order: activities, then the route — track ("Draw on map" primary), start, end, grade (D9); start/end fold into a "Set by hand" row while both are empty; tests in `tour-form.test.ts`
- [x] 8.3 Points the track set follow a redrawn or replaced track; hand-set and saved points never move; tests in `tour-form.test.ts`
- [x] 8.4 Ski route card in the tour sheet's layout (D10): disc, altitude headline, `GradeBadge`, ascent time, `RouteNumbers`, full buttons; grade badge in the list rows; test in `trail-card.test.ts`
- [x] 8.5 Locale keys (en, de-CH) and `check:locales`; onboarding "Plan a tour" copy mentions drawing the route after the goal
- [x] 8.6 `npx eslint . --fix`, `npx eslint`, `npm run type-check`, `npm run test`; `openspec validate --strict`
- [x] 8.7 Headless walk at 360 px de-CH (ski route down a forest road, no layer on roads, form fold and redraw, route card); persona review loop on the form and the card until it passes
- [x] 8.8 Review round 2 (owner decisions): legs along the ways far round go straight (2.5×, +500 m; test in `use-track-drawing.test.ts`); a point's name and height wait under one skeleton and show together (tests in `tour-form.test.ts`)

## 9. The user's pace

- [x] 9.1 `estimatedMinutes` takes the pace; `tourMinutes` times a tour by its activities (on skis, none for lifts/bikes/climbing alone or a flown way); `onSkis` shared with `snapNetworkFor`; tests in `route-metrics.test.ts`
- [x] 9.2 `core/composables/use-pace.ts`: the pace per device (`tb.pace`, 50–150 %); test in `use-pace.test.ts`
- [x] 9.3 Panel: the time opens the tortoise → hare slider; the closed time's icon turns tortoise or hare off 100 %; test in `track-draw-panel.test.ts`
- [x] 9.4 The time in the form's track tile and the tour detail (`RouteNumbers` `minutes`); `formatDuration` in `use-formatter`; locale keys (en, de-CH)
- [x] 9.6 Review round 1: the pace beside every time off 100 % (`PaceNote`); SAC's ascent time on the ski route card labelled and at the pace (`labelMinutes`); slider in the status line's place; "2:05 h" times; 44 px time button; route numbers on one baseline; tests in `route-numbers.test.ts`, `trail-card.test.ts`, `route-metrics.test.ts`, `track-draw-panel.test.ts`
- [x] 9.5 Checks (`eslint`, `type-check`, `test`, `openspec validate --strict`); persona review loop until it passes
