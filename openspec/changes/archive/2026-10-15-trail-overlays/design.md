# Design

## Context

See proposal.md for the motivation. Constraints that shape the approach:

- **Style switches wipe custom layers.** `tourenbuddy-map.vue` swaps base maps with `setStyle()`, which drops
  every app-added source and layer. Markers and GPX are rebuilt in a `style.load` handler today. Anything
  new has to rejoin that path.
- **Only one data form covers both layers.** Ski routes exist only as WMTS raster tiles. Hiking trails also
  appear in `ch.swisstopo.base.vt`, but only when the vector style is on. Raster WMTS is the one
  representation that works for both overlays on both base maps.
- **Raster has no geometry.** Lookup and future snapping need lines. GeoAdmin `identify` returns them
  (`geometryFormat=geojson`, `sr=4326`) with no key and CORS `*`. Ski routes come back as whole routes
  (`MultiLineString`). Hiking trails come back as junction-to-junction segments without name or destination,
  which is one reason hiking stays display-only. Verified 2026-10-13.
- **Ski attributes are sparse.** Many routes carry no route info (`target_name: null`, placeholder `name`),
  and translations are often missing.
- **Density.** Both overlays serve tiles down to z8 (75–100 KB/tile there vs 10–20 KB at z12). A 24 px tap
  at z≈8.5 hits about 30 ski routes, and about 4 at z≈12. Measured 2026-10-13.
- **Existing patterns to reuse.** `swisstopo-name-service.ts` (plain identify service function),
  `tour-info-sheet.vue:801` (`isDesktop ? SideDrawer : BottomSheet`), `frame-tour.ts` (camera framing beside
  the covering sheet/drawer), `use-tour-filters.ts` (guarded `localStorage`). Features may not import each
  other's internals, so the map feature gets its own identify service, mirroring the shape but sharing no code.

## Goals / Non-Goals

**Goals:**
- Overlay toggles that never disturb marker/GPX draw order, on either base map, across any number of switches.
- A lookup path whose output (entity with polylines, nearest-point math) later drawing/snapping reuses unchanged.

**Non-Goals:**
- Hiking-trail lookup (display-only: the raster already encodes the category).
- Bulk trail loading by bounding box, a routing graph, snapping UI: kept additive (D6).
- Offline region downloads of overlays. Runtime caching (D10) is in scope.
- A generic "any WMTS overlay" framework, or a shared `tours`/`map` identify helper.

## Decisions

### D1 — Raster WMTS overlays, always present, toggled by visibility

On every style load (initial `load` and each `style.load`) a `trail-layers.ts` module, shaped like
`gpx-track-layer.ts`, adds the following in order:

1. one raster source + layer per overlay (hiking, then ski) with `layout.visibility` set from store state;
2. the highlight GeoJSON source with three line layers: faint candidates, a casing, and the selected line.

It runs **before** `markerLayer.setup()` and `gpxLayer.setup()`. MapLibre appends layers in call order, so
everything added later stacks above the overlays. Toggling is `setLayoutProperty(id, 'visibility', …)`.

*Why visibility, not add/remove:* with add/remove, each insert needs a `beforeId` that works whichever
overlays, markers and GPX layers exist. Toggle ski and then hiking, and naïve inserts end up in the wrong
order. A fixed stack built once per style load is ordered by construction. Hidden raster layers request no
tiles.

*Why the `style.load` path, not `setStyle(…, { transformStyle })`:* markers and GPX already rebuild in
`style.load`. A second re-add mechanism would be a second place to get the order wrong.

Sources set `maxzoom` to each WMTS matrix limit (18 hiking, 17 ski) so MapLibre overzooms. Tile URL:
`https://wmts.geo.admin.ch/1.0.0/<layer>/default/current/3857/{z}/{x}/{y}.png`.

### D2 — Overlay registry as single source of truth

`features/map/data/trail-overlays.ts`, next to `swisstopo-styles.ts`:

```ts
export type TrailOverlayId = 'hiking' | 'ski'
export const TRAIL_OVERLAYS: TrailOverlay[] = [
  { id: 'hiking', layerBodId: 'ch.swisstopo.swisstlm3d-wanderwege', maxzoom: 18, labelKey, thumbnail },
  { id: 'ski', layerBodId: 'ch.swisstopo-karto.skitouren', maxzoom: 17, labelKey, thumbnail, identifiable: true },
]
```

Array order is draw order. The layer module, panel, persistence schema, SW route matcher and identify
request all derive from it. `identifiable` marks the overlays that lookup queries (only ski now).

### D3 — State and persistence in `map-store`

`map-store` gains `activeOverlays: Ref<TrailOverlayId[]>` + `toggleOverlay(id)`. It is read from
`localStorage` (`tb.map.overlays`) once at store creation, Zod-parsed (`z.array(z.string())`, then filtered
to known ids so one stale entry doesn't wipe the rest), written on change, and wrapped in try/catch like
`use-tour-filters.ts`. It also gains `trailCard: Ref<{ candidates: Trail[], more: number, selectedId: string | null } | null>`
(`more` = hits beyond the 8 shown).
Device-local on purpose: overlay choice is situational per device (desk planning vs. phone in the field),
and syncing it via `user_profile` would cost a migration plus offline-queue plumbing for a preference.
`currentStyleIndex` stays unpersisted, because Classic on an offline cold start would be blank.

### D4 — Tap routing

`tourenbuddy-map.vue` emits `mapBackgroundClick({ point, lngLat })` (today: no payload). The handler in
`map-page.vue`:

```
picking / drawing                      → return                      (unchanged)
activeOverlay not in {null, trail-info} → closeOverlay()             (unchanged)
ski overlay off || offline             → closeOverlay()             (no-op if nothing open)
zoom < 12                              → snackbar "zoom in"; closeOverlay()
else                                   → trailLookup.lookup(point)   (hit: open/replace card; miss: close card)
```

The trail card is the one sheet whose content is *about* the map, so tapping the map changes it. Every other
sheet keeps the "tap map = close" habit. The picking branch is where future snapping hooks in.

### D5 — Clickable routes: viewport load, local taps

*Revised after first local checks:* only routes with route info are clickable, and they are visibly marked,
so what the map marks is exactly what a tap can open.

- **Viewport load** `use-trail-lookup.ts`: with the ski overlay on, online and zoom ≥ 12, `refresh()` runs on
  `moveend` and loads every ski route crossing the viewport (identify envelope). No request while the view
  stays inside the loaded extent. A newer view aborts the pending load and a stale result is never applied
  (checked against the owning `AbortController`). Routes with `route: null` are dropped. The set is cleared
  when the overlay goes off, below z12 or offline. It is mirrored into `map-store.clickableTrails` for the map.
- **Why z12, not z11:** identify can't filter by attribute (`target_name` isn't queryable) and responds
  uncompressed with all four languages: ≈350 KB per phone viewport at z12, ≈660 KB (capped at 201 routes)
  at z11. Measured 2026-10-15.
- **Taps resolve locally**, against the loaded set, with no request per tap: project vertices (`map.project`),
  `nearestOnPolylines`, keep routes ≤ tolerance (`(pointer: coarse)` → 24 px, else 10), nearest-first, max 8 +
  remainder. A tap during a pending load awaits it; a failed load shows `map.trail.lookupError` on tap only.
- **Service** `identifySkiRoutes({ bounds, size, locale, signal })`: `esriGeometryEnvelope`, `tolerance=0`,
  `geometryFormat=geojson`, Zod-validated, 10 s timeout (a viewport is larger than a point query). The
  mapper normalizes `LineString | MultiLineString` → `lines: LngLat[][]`, localizes (`x_<lang> ?? original`;
  `de-CH → de`) and maps `target_name == null` → `route: null`.
- **Marking** (`trail-layers.ts`, `ski-badge.ts`): a blurred halo line under the ski raster (the route reads
  as the same blue line, glowing) and difficulty badges placed along each route (`symbol-placement: line`,
  ~220 px apart) with label collision: routes sharing an approach show one badge there instead of a stack,
  and each route still gets badges on its own stretch. Above the highlight, below GPX/tour markers. The badge is a pill in the difficulty color with a skier glyph and
  the difficulty, white ring, soft shadow; canvas-drawn on demand (`styleimagemissing`), keyed by color +
  label. Halo and badge share one color per SAC grade, sky (L) → blue → indigo → violet → purple (SS) →
  deep purple (AS, EX), modifiers between stops; no difficulty = stone grey (`#78716C`, as a tour with no
  activity type), a round badge with just the skier. `domain/ski-difficulty.ts` grades both scales
  Swisstopo localizes to (German `L…EX` in `_de`, French `F…EX` in `_en/_fr/_it`), `+`/`-` included, so
  the badge shows the same string as the card.
- **Entity** `features/map/domain/entities/trail.ts`, framework-free:
  `{ overlay: 'ski', id: string, lines: LngLat[][], route: SkiRouteInfo | null }`.
- **Ordering** `features/map/domain/nearest-point.ts`: pure planar `nearestOnPolylines(p, lines)` →
  `{ distance, point, lineIndex, segmentIndex, t }`. Coordinate-agnostic on purpose: snapping a drawn vertex
  is the same call.

### D6 — Groundwork boundaries for snapping

Built now and reused unchanged: the `Trail` entity with polylines, `nearestOnPolylines`, the registry, and
the highlight source pattern, and the envelope service (verified for both layers). Snapping will add a
hiking `Trail` member, a graph builder and a routing step. All are additive. No repository interface now: there is one implementation.

### D7 — Map layers panel UI

`map-layers-panel.vue` replaces `map-base-map-panel.vue` (entry renamed `base-map` → `map-layers`, icon
`layers` newly registered in `icons.ts`, **always enabled**). *Revised after first local checks:* the panel
takes the speed-dial menu's place, bottom-right right above the trigger, instead of unfolding beside the
menu item. Beside the item it was cut off on phones and out of right-thumb reach; the menu is unusable while
the panel is open anyway. The trigger (✕) closes it. A glass card, `--radius-lg`, two titled sections,
`max-width` = viewport minus margins. `layer-tile.vue`:

- 72×72 thumbnail (`--radius-md`), label underneath, `<button>`.
- Selected: 2 px accent ring with offset, plus a check badge popping in at the top-right. Unselected tiles are
  slightly desaturated so the active set reads at a glance. Press scale-down. Motion off under
  `prefers-reduced-motion`.
- Base section: `role="radiogroup"`, tiles `role="radio"` + `aria-checked`, arrow keys. Offline: the tiles
  are `disabled`, with a "Needs a connection" hint under the section title. Overlay tiles: `aria-pressed`,
  togglable offline (visibility only).
- A base pick closes the panel. Overlay toggles keep it open.

Thumbnails: four static 144×144 PNGs in `public/map-layers/`, rendered once headless at 8.368/46.781 z13
(above Engelberg, where both networks cross). The overlay
thumbnails are composited over the Base capture, so you see trails on a map. They are precached by the
existing `injectManifest` glob (covers `png`). No network on open, no pop-in, works offline.

### D8 — Trail card

`trail-card.vue` renders as `isDesktop ? SideDrawer : BottomSheet`, mirroring `tour-info-sheet.vue`, and is
opened as page overlay `trail-info`. There are two states:

- **List** (more than one candidate): rows of target · altitude + difficulty chip (or name / "Ski route"),
  nearest first, max 8, "+N more — zoom in". All candidates use the faint highlight layer. Extracted to
  `trail-candidate-list.vue`.
- **Detail**: header with the `downhill_skiing` icon and route name; target · altitude, difficulty chip,
  ascent time, ↑/↓ m, and "Open in SAC tour portal" (`target="_blank" rel="noopener"`). Missing fields are
  omitted, and there's a no-info variant. Back arrow to the list when it came from one.
- Footer "© swisstopo".
- Highlight is orange (`--orange-500`), not the accent blue: Swisstopo draws ski routes blue.
- Snackbars: "zoom in" uses a new neutral `info` tone of `ErrorSnackbar` (`role="status"`); the lookup error
  keeps the error tone.

**Framing:** `frame-tour.ts` is refactored into `frameBounds(map, bounds, covered)`. `frameTour` becomes a
thin wrapper building bounds from goal/start/end. The card frames the candidates' (list) or the route's
(detail) bounds with the existing covered-area padding, **only if** those bounds aren't already inside
the uncovered viewport. Re-framing on every tap while exploring would be irritating.

A watch clears `trailCard` whenever `activeOverlay` leaves `'trail-info'`. That one rule covers close,
tour selection and opening any other sheet.

### D9 — Onboarding

Step 2's surface `base-map-panel` → `map-layers-panel`, target `[data-tour="map-layers"]` on the panel root.
New copy covers base maps and overlays and ends with "turn on ski routes and tap one for details". The
driver only opens the panel (`openMapLayers()`, renamed from `openBaseMap()`) and never toggles state.

### D10 — Overlay tile caching

A new SW route, registered **before** the generic WMTS route, matches `wmts.geo.admin.ch` paths whose layer
segment is in `TRAIL_OVERLAYS` and uses `CacheFirst` in a dedicated `swisstopo-trail-overlays` cache
(`ExpirationPlugin` 1500 entries, 30 days). The existing `swisstopo-wmts` SWR route keeps serving Classic.

*Why CacheFirst, not SWR like the base map:* SWR answers from the cache but **still issues a background
request per tile view**. With Swisstopo's `max-age=3600` + `ETag` that is usually an HTTP-cache hit or a
`304`, and a full re-download only after the browser evicts its HTTP cache (common on phones). The cost is
requests, radio wake-ups and competing bandwidth on poor mountain connections, not mostly payload. Not
worth paying for networks that change about once a year. (Moving the base map to the same rule is
#325.) *Why a dedicated cache:* sharing the
500-entry cap would make Classic and overlays evict each other. The worst case is about 20–30 MB. Side
effect: overlay tiles you've already viewed render offline for 30 days.

## Risks / Trade-offs

- [Up to 30 days stale overlay tiles] → Acceptable for networks updated about yearly. Bump the cache name to
  force a refresh if Swisstopo restyles.
- [GeoAdmin identify latency / availability] → 5 s timeout, error snackbar, the map stays usable.
- [Tolerance in a `sr=4326` extent is approximate under Mercator] → Negligible at 10–24 px. Ordering uses
  projected pixel distance anyway.
- [Many ski routes have no info] → Spec'd generic state. The highlight alone still answers "where does it go".
- [Hiking trails unexplained for users who don't know waymark colors] → Accepted (no legend in scope).
- [Two taps to inspect a route while a *tour* sheet is open] → Deliberate (D4).
- [Zoomed-out overlay pans cost about 0.5–1 MB on mobile] → Only with an overlay on. CacheFirst makes repeat
  views free.
- [Swisstopo renames/retires a layer id] → One registry entry. A failing identify degrades to the snackbar.

## Migration Plan

Frontend + service worker only, no DB/Worker change. The new localStorage key starts empty (all overlays
off). The new SW cache appears on the next SW update (prompt flow). Rollback = revert: the stale key is
ignored, and the orphaned cache is harmless (or deleted by name in a follow-up).
