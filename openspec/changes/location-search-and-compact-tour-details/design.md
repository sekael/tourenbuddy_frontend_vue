# Design

## Context

- The location picker (`location-picker.vue`) is a crosshair fixed at the canvas centre; confirm
  reads `map.unproject(canvas centre)` — deliberately not `getCenter()`, because `frameTour()`
  leaves camera padding set on the map. It is shared by every pick (goal/start/end, creation and
  edit) and emits `confirm({ lng, lat })` to `map-page.vue`, which runs `getElevation` +
  `suggestTourName` (swissNAMES identify within a radius) and hands results to the form/sheet.
- Swisstopo calls already go straight to `api3.geo.admin.ch` (height, identify) with a 5 s
  `AbortController` timeout. The `SearchServer` endpoint on the same host returns WGS84
  `lat/lon`, a `zoomlevel`, an `origin` and an HTML `label`
  (`<i>Alpiner Gipfel</i> <b>Piz Bernina</b> (GR) - Pontresina`).
- `tour-info-sheet.vue` is ~1700 lines; the view-mode template is hero card → owner toggle row →
  three `facts-section`s.
- Icons resolve through `core/components/icons.ts` (static `~icons/material-symbols/*` imports);
  Material Symbols / all Iconify sets were checked — none has an uphill skier or splitboarder.

## Goals / Non-Goals

**Goals:**
- One search UI inside the existing picker; no new pick mode or route.
- Search result → crosshair; the confirm path stays the single source of the picked location.
- Compact detail view without changing what data it shows.

**Non-Goals:**
- Offline search / caching search results (search hidden offline).
- Search outside the picker (e.g. a general map search bar).
- Revisiting icons of other tour types (ski-mountaineering, mountaineering, climbing).
- Changing the edit-mode form layout.

## Decisions

### D1 — GeoAdmin SearchServer, called from a map data service
`features/map/data/services/swisstopo-search-service.ts` exports
`searchLocations(query, lang, signal) → LocationResult[]` with
`{ name, kind, region, lng, lat, zoom }`. Request:
`SearchServer?type=locations&searchText=…&sr=4326&limit=30&lang=<de|en>&origins=gazetteer,zipcode,gg25,address`
(drops `parcel`/`district` noise). Response validated with Zod (project rule for API responses);
invalid entries are dropped, not thrown.
*Why map feature:* the picker that consumes it lives there; the tours services stay untouched.
*Alternative:* Nominatim/OSM — rejected: rate limits, attribution/usage policy, weaker alpine
toponymy than swissNAMES3D; GeoAdmin is the same source as our map and name lookup.

### D2 — Label parsing via `DOMParser`, never `v-html`
`name` = text of `<b>`, `kind` = text of `<i>`, `region` = remaining text, all through
`DOMParser().parseFromString(label, 'text/html')` → `textContent`. Decodes entities
(`&amp;`), executes nothing, and Vue renders the strings as text.
*Alternative:* regex strip — rejected: misses entities and is brittle on nested tags.

### D3 — Zoom by origin, not the API's `zoomlevel`
The API's `zoomlevel` is on swisstopo's LV95 tile scale, not MapLibre's. A small table maps
origin → MapLibre zoom: `gazetteer` 14, `address` 17, `zipcode`/`gg25` 12.
*ponytail:* static table; derive from `geom_st_box2d` (fitBounds) only if area results land badly.

### D3b — Proximity tie-break for duplicate names
`rankResults(results, center, zoom)` (pure, in the search service) keeps the API order but,
from zoom 9 up, sorts each group of results with an identical `name` by distance to the map
centre, placing the group at its best-ranked member's position; then takes the first 8.
Below z9, API order unchanged. 30 candidates are fetched so a nearby duplicate outside the
API's top 8 still surfaces.
*Why only duplicates:* a global distance sort would bury the place the user typed under nearby
partial matches; duplicates (Schwarzhorn, Rothorn) are the actual ambiguity.
*Why z9:* below it the view is all of Switzerland / a large region — no real intent to bias by.
*Alternative:* GeoAdmin `bbox` — rejected, filters instead of ranks.

### D4 — Picker owns search state; jump with zero padding
`location-picker.vue` holds query, results, request state and `lastChosen`. Query →
`watchDebounced` (300 ms, ≥ 2 trimmed chars) → abort previous `AbortController` → fetch.
Choosing a result: `map.jumpTo` / `flyTo({ center, zoom, padding: 0 })` — padding **must** be
reset so the result lands under the canvas-centre crosshair (see Context). `flyTo` normally,
`jumpTo` when the user prefers reduced motion (`usePreferredReducedMotion`), per the "No
unnecessary motion" requirement. Hidden when `isOnline` is false.
The input itself is the tour list's `search-row` extracted to `core/components/search-input.vue` (v-model, clear button, `enter`/`escape` emits) and reused by `tour-list-sheet.vue` — second consumer, so it earns a shared component. List closes + input blurs on choose, map `movestart` from user input (`originalEvent` set), and Escape.
*Alternative:* separate `location-search.vue` component — rejected for now; picker is 87 lines,
search adds ~100. Extract if it crosses the ~150-line convention by more than a little.

### D5 — Name handoff on the existing `confirm` event
`confirm` payload becomes `{ lng, lat, name?: string }`. The picker sets `name` only when
`lastChosen` is within 50 m of the crosshair (`LngLat.distanceTo`, built into MapLibre). In
`map-page.vue`, every name-lookup site (`goal` initial, goal re-pick, start, end, edit
pick) uses `location.name ?? await suggestTourName(location)`; elevation lookup is unchanged.
*Why 50 m:* survives accidental touch drift on mobile, but any deliberate pan to a different
feature falls back to the radius lookup.
*Alternative:* a separate `nameHint` store field — rejected: more state, same effect.

### D6 — Compact detail: one new presentational component
View-mode facts move into `features/tours/presentation/components/tour-fact-rows.vue`
(props: `tour`, `startPointText`, `endPointText`, flags; a `partners` slot keeps the
contact-chip events in the sheet). The hero stays in the sheet as a fixed two-line block: line 1 badge + goal elevation headline +
toggles (end-aligned, never wrap); line 2 muted `date · coords` (wraps freely); friend tours add
an owner line. The hero date uses `month: 'short'` in `formatRange` so a cross-month span fits
(still locale range formatting, so "Planned date renders as a span" holds). No elevation → the
date moves to line 1 with the two owner toggles as
`BaseIconButton`s (`aria-pressed`, `aria-label`). Section headings, `fact-grid`, `detail-card`
and the owner-toggles row are deleted with their styles. The hero card's success ring and
dashed private edge go too — the badge stamps carry the state.
*Why extract:* shrinks the 1700-line sheet, makes the fact ordering testable in isolation.

### D7 — Custom icons via unplugin-icons `customCollections`
`vite.config.ts`: `Icons({ compiler: 'vue3', customCollections: { tb: FileSystemIconLoader('./src/assets/icons') } })`.
Two 24×24 `viewBox` SVGs (`ski-touring.svg`, `splitboarding.svg`, `fill="currentColor"`,
optical weight matched to Material Outlined 400) imported as `~icons/tb/ski-touring` and
registered in `icons.ts` as `ski_touring` / `splitboarding`; `TOUR_TYPE_ICONS` points
`skitour`/`splitboarding` at them. Same bundling, tree-shaking and offline precache as all icons.
*Alternative:* a second Iconify set (`mdi`) — rejected, no suitable glyph exists (checked).

## Risks / Trade-offs

- [GeoAdmin search unavailable or slow] → 5 s timeout, error message in the list; picking by
  panning keeps working.
- [Search result kinds are German source terms ("Alpiner Gipfel")] → shown as data, not UI copy;
  acceptable for a Swiss-only map. Localize via an origin/objectclass map later if users ask.
- [Jump with `padding: 0` resets padding that `frameTour` set] → every later framing call passes
  its own padding already; confirm reads `unproject`, so nothing depends on stale padding.
- [Hand-drawn glyphs look off next to Material icons] → render both at sm/md/lg next to
  `downhill_skiing`/`snowboarding` in a screenshot for user sign-off before merge.
- [Info-sheet tests target removed classes] → update selectors in the same task group as the
  template change.
