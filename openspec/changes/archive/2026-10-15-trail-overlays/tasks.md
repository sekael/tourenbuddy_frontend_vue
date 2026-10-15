# Tasks

## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/324-trail-overlays`

## 2. Domain & data (D2, D5, D6)

- [x] 2.1 Add overlay registry `features/map/data/trail-overlays.ts` (`TrailOverlayId`, `TRAIL_OVERLAYS` in draw order hiking → ski; `layerBodId`, `maxzoom`, `labelKey`, `thumbnail`, `identifiable`)
- [x] 2.2 Add framework-free `Trail` entity `features/map/domain/entities/trail.ts` (`overlay: 'ski'`, `id`, `lines: LngLat[][]`, `route: SkiRouteInfo | null`)
- [x] 2.3 Add pure `nearestOnPolylines(p, lines)` in `features/map/domain/nearest-point.ts` returning `{ distance, point, lineIndex, segmentIndex, t }`
- [x] 2.4 Add Zod identify-response schema + `identifySkiRoutes(...)` in `features/map/data/services/swisstopo-trail-service.ts` (viewport `mapExtent`/`imageDisplay`, caller-supplied tolerance, `geojson` geometry, 5 s timeout, abort signal; LineString/MultiLineString → `lines`; localized fields `x_<lang> ?? original`, `de-CH → de`; `target_name == null` → `route: null`)

## 3. State (D3)

- [x] 3.1 Extend `map-store`: `activeOverlays` + `toggleOverlay(id)` persisted to `localStorage` `tb.map.overlays` (try/catch, Zod parse, unknown ids filtered); `trailCard` (`candidates`, `selectedId`) + actions

## 4. Map rendering (D1, D8)

- [x] 4.1 Add `features/map/presentation/components/trail-layers.ts`: per-overlay raster source/layer with visibility from state; highlight source with faint-candidate, casing and selected line layers; `setup()`, `setVisible(ids)`, `setHighlight(candidates, selectedId)`
- [x] 4.2 Wire into `tourenbuddy-map.vue`: `trailLayers.setup()` before marker/GPX setup on `load` and every `style.load`; reapply visibility + highlight after a switch; watch `activeOverlays` / `trailCard`
- [x] 4.3 Emit `mapBackgroundClick` with `{ point, lngLat }`
- [x] 4.4 Refactor `frame-tour.ts` into `frameBounds(map, bounds, covered)` + thin `frameTour` wrapper; add an "already fully visible beside the cover" check

## 5. Ski route lookup & card (D4, D5, D8)

- [x] 5.1 Add `use-trail-lookup.ts`: pointer-based tolerance (24 coarse / 10 fine), abort + request counter supersede, project + order by `nearestOnPolylines`, cap 8 + total, non-abort error snackbar
- [x] 5.2 Route background taps in `map-page.vue` per D4 (picking/drawing; other sheet → close; ski off/offline → close; zoom < 12 → "zoom in" snackbar; else lookup, hit opens/replaces card, miss closes it); clear `trailCard` when `activeOverlay` leaves `'trail-info'`
- [x] 5.3 Add `trail-card.vue` (`isDesktop ? SideDrawer : BottomSheet`): detail state (name, target · altitude, difficulty chip, ascent time, ↑/↓ m, SAC link in new tab; no-info variant; missing fields omitted; back to list; "© swisstopo")
- [x] 5.4 Add `trail-candidate-list.vue` (nearest-first rows, "+N more — zoom in", row → detail)
- [x] 5.5 Frame candidates (list) / route (detail) with `frameBounds` beside the card, only when not fully visible

## 6. Map layers panel (D7)

- [x] 6.1 Capture four 144×144 PNG thumbnails into `public/map-layers/` (base, classic; hiking + ski composited over the base capture; Engelberg area, z13)
- [x] 6.2 Register `layers` icon in `src/core/components/icons.ts`
- [x] 6.3 Add `layer-tile.vue` (thumbnail, label, accent ring + check badge, desaturated unselected, press/badge motion, reduced-motion off, `disabled` state)
- [x] 6.4 Add `map-layers-panel.vue` (Base map `radiogroup` with arrow keys, disabled offline with "Needs a connection" hint; Overlays `aria-pressed` toggles working offline; base pick closes, overlay toggle keeps open) and delete `map-base-map-panel.vue`
- [x] 6.5 Rename speed-dial entry `base-map` → `map-layers` (label "Map layers", icon `layers`, no offline disable) in `use-map-overlay.ts` / `map-action-overlay.vue`; rename `openBaseMap` → `openMapLayers`

## 7. Service worker (D10)

- [x] 7.1 In `src/sw.ts`, before the generic WMTS route, register `CacheFirst` for trail-overlay WMTS paths (layer ids from `TRAIL_OVERLAYS`) in `swisstopo-trail-overlays` (1500 entries, 30 days)

## 8. Onboarding & i18n (D9)

- [x] 8.1 Update onboarding step 2: surface `map-layers-panel`, target `[data-tour="map-layers"]`, map-page surface driver, new title/body/label copy mentioning tapping ski routes
- [x] 8.2 Add/replace strings in `en.json` and `de-CH.json` (panel sections, overlay names, needs-connection hint, card labels, no-route-info note, "+N more — zoom in", zoom-in snackbar, lookup error, onboarding copy); drop unused base-map keys; `npm run check:locales`

## 5b. Feedback from first local checks (D5, D7 revised)

- [x] 5b.1 Load ski routes per settled viewport (envelope identify, z ≥ 12, no refetch inside loaded extent, supersede); only routes with info are clickable; taps resolve locally
- [x] 5b.2 Mark clickable routes: halo under the ski raster + marker on each route
- [x] 5b.3 Layers panel takes the menu's place above the trigger (thumb reach, fits narrow screens); drop the speed dial's `expanded` slot
- [x] 5b.4 Difficulty on the marker: label + per-grade color (blue L → purple SS → deep purple EX, grey = none) on marker and halo; `skiDifficultyGrade` grades German and French notation with modifiers
- [x] 5b.5 Polish: difficulty badges (canvas pill with skier glyph, shadow) placed along routes with collision (no stacking on shared stretches); panel thumbnails all show the same Säntis excerpt per layer, with an icon chip on overlay tiles

## 9. Tests (edge cases only)

- [x] 9.1 `nearestOnPolylines`: zero-length segment, projection clamped past segment ends, multi-line picks the closest part, empty input
- [x] 9.2 `identifySkiRoutes` mapper: MultiLineString normalization, missing translation falls back to original, `target_name: null` → `route: null`, response failing Zod rejects
- [x] 9.3 `map-store` overlays: corrupt JSON, unknown id filtered while known kept, `localStorage` throwing
- [x] 9.4 `use-trail-lookup`: superseded viewport load never applied; no refetch inside loaded extent; no-info routes unclickable; failed load reports on tap only; tolerance filter; > 8 hits capped with correct remainder
- [x] 9.5 Tap routing: zoom < 12 shows snackbar without lookup; miss with card open closes it; tap with a tour sheet open only closes it
- [x] 9.6 `map-layers-panel`: offline disables base tiles but not overlay toggles; overlay toggle keeps panel open; base pick closes

## 10. Verification

- [x] 10.1 Walk the real app headless: overlays on both base maps + switching (order under GPX/markers); reload keeps overlays; ski tap single + shared approach list + no-info route; desktop drawer vs mobile sheet framing; zoomed-out snackbar; offline panel; DevTools shows cached overlay tiles served with no network request
- [x] 10.2 Run the onboarding tour end-to-end over the new layers step

## 11. Finalize

- [x] 11.1 `npx eslint . --fix`, then `npx eslint` (zero warnings), `npm run type-check`, `npm run test`
- [x] 11.2 Prompt the user to commit with a ready-to-copy message, e.g. `feat(map): add Swisstopo hiking trail and ski route overlays`
- [x] 11.3 Prompt the user to push and open a PR closing #324 (squash title `feat(map): …`)

## Workflow follow-up

- After merge, archive with `openspec-archive`.
