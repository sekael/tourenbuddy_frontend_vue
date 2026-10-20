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
With `lang=de` GeoAdmin transliterates most kinds ("Gebaeude", "Huegel", "Oeffentliches";
names and regions keep their umlauts, `lang=en` returns "Building"), so `restoreUmlauts` turns
`ae/oe/ue` back into umlauts in German kinds, except "ue" after q, a or e (Quelle, Mauer).
Checked against the kinds of ~60 live queries. *Alternative:* an objectclass → i18n map —
rejected for now, the service already localizes and the map would trail swissNAMES3D.
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

### D4b — One bottom dock for results, field and actions
Results, field and Cancel/Confirm stack in one fixed dock at the bottom centre (all breakpoints):
thumb reach on phones, and the top stays free for the collapsed overlay header (desktop dialog
bar top-centre, drawer top-right). The dock spans from the visible top to its bottom offset and
stacks its children at the bottom, so a long list scrolls instead of running off-screen. While
the user searches on a touch screen (`(hover: none)`, field focused or list open) the dock flips:
field at the visible top, results below it, actions hidden. Field: frosted pill with our own
clear button, which keeps the field focused when pressed so the dock never flips mid-tap.
*Why not ride on the keyboard:* the first version lifted the dock by the keyboard height
(`innerHeight − vv.height − vv.offsetTop`). On phones (2026-10-20) iOS Safari now shrinks
`innerHeight` with the keyboard, so nothing was detected and the actions plus sheet peek left
~140 px of results; Brave iOS resizes the layout viewport as well (brave-browser#54999) and
reported the visible area ~230 px short, stranding the field mid-map. Only the visible top was
right in both, so `useVisualViewportTop` (`core/composables`) keeps just the iOS pan offset
(0 while pinch-zoomed). Staying flipped while the list is open means a blur on the way to a
result tap never moves the result. ponytail: the list keeps `min(50dvh, 360px)`; where `dvh`
ignores the keyboard (older iOS) its last rows may sit under the keys until "Done".
*Alternative:* top field on desktop, bottom on mobile — rejected: two layouts, and the desktop
top is already taken by the collapsed dialog/drawer header.

### D5 — Name handoff on the existing `confirm` event
`confirm` payload becomes `{ lng, lat, name?: string }`. The picker sets `name` only when
`lastChosen` is within 50 m of the crosshair (`LngLat.distanceTo`, built into MapLibre). In
`map-page.vue` passes it on with the pick; the form uses it instead of the nearby lookup
(D8).
*Why 50 m:* survives accidental touch drift on mobile, but any deliberate pan to a different
feature falls back to the radius lookup.
*Alternative:* a separate `nameHint` store field — rejected: more state, same effect.

### D6 — Compact detail: one new presentational component
View-mode facts move into `features/tours/presentation/components/tour-fact-rows.vue`
(props: `tour`, `startPointText`, `endPointText`, flags; a `partners` slot keeps the
contact-chip events in the sheet). The hero stays in the sheet as a fixed two-line block: line 1 badge + goal elevation headline;
line 2 muted `date · coords` (wraps freely); friend tours add
an owner line. The hero date uses `month: 'short'` in `formatRange` so a cross-month span fits
(still locale range formatting, so "Planned date renders as a span" holds). No elevation → the
date moves to line 1. The owner-toggles row (labelled tonal buttons, `aria-pressed`) stays
directly below the hero: icon toggles in the hero line were tried, and a bare circle / lock
did not read as "complete the tour" / "make private". Section headings, `fact-grid` and
`detail-card` are deleted with their styles. The hero card's success ring and
dashed private edge go too — the badge stamps carry the state.
*Why extract:* shrinks the 1700-line sheet, makes the fact ordering testable in isolation.
*Groups (follow-up):* the rows render as `<ul class="fact-group">` blocks — activity (type,
seasons), route (start, end, GPX via a `route` slot, like partners), partners, free texts — each
omitted when empty and led by a `--divider-color` rule; the component root is
`display: contents`, so the groups share the sheet's column gap. The sheet gives the
attachments strip (now one root, so the class lands) and the suggestions block the same divider.
Dividers stay content-width: the suggestions block's full-bleed margins had lost their border
already and are removed. Section headings stay out — the icons name the rows.

### D7 — Custom icons via unplugin-icons `customCollections`
`vite.config.ts`: `Icons({ compiler: 'vue3', customCollections: { tb: FileSystemIconLoader('./src/assets/icons') } })`.
Two 24×24 `viewBox` SVGs (`ski-touring.svg`, `splitboarding.svg`, `fill="currentColor"`,
optical weight matched to Material Outlined 400) imported as `~icons/tb/ski-touring` and
registered in `icons.ts` as `ski_touring` / `splitboarding`; `TOUR_TYPE_ICONS` points
`skitour`/`splitboarding` at them. Same bundling, tree-shaking and offline precache as all icons.
*Alternative:* a second Iconify set (`mdi`) — rejected, no suitable glyph exists (checked).
*Climbing and mountaineering (follow-up):* both shared Material's generic `landscape`.
`mountaineering.svg` is Temaki's `climbing` pictogram (CC0, the classic hiker scrambling up a
rock step); `climbing.svg` is drawn here — a climber under an overhang with a chalk bag — both
after user-supplied references. Rejected: Material `mountain_flag` (an outline landscape among
solid figures), a hiker with pole or ice axe (read as hiking), CC-BY sets (`game-icons`, they
need in-app credit). *Ski mountaineering (follow-up):* Material's mountains (`terrain`) becomes
`ski-mountaineering.svg` — the mountaineering figure, scaled down, with two skis A-framed on the
pack: mountaineering plus skis, distinct from the ski-touring figure that stands on a ski.
`terrain` had no other user and leaves the registry. Rejected: Pinhead's skier carrying skis on
the shoulder (CC0; reads as a resort skier walking to the lift). `tour-type.test.ts` checks
every `TOUR_TYPE_ICONS` name is registered, since an unknown name renders nothing.
*Equipment row (follow-up):* the free texts are named by their icon alone, and `backpack` did not
say "gear" (it also repeats the packs on the mountaineering glyphs). `ice-axe.svg` (tilted pick,
adze and spiked shaft, fitted to Material's 20-unit live area) replaces it; `backpack` had no
other user. Rejected: carabiners (`mdi`, `iconoven`, `energy-icons`; a "?", "G" or paperclip at
18 px), a rope coil (a spiral), Material `checklist` (says "list"), `construction` / `handyman`
(say "repair"). `tour-fact-rows.test.ts` checks every row icon is registered.

### D8 — The form looks up name and elevation, each field on its own
Found while testing: Swisstopo's height service answered in 1–13 s or failed (502/503), and
`map-page.vue` awaited `Promise.all([getElevation, suggestTourName])` before opening the
dialog, so a slow height also held back the fast name. Now `map-page.vue` and the info sheet
pass only a `pick` (`{ type, location, name? }`, a new object per pick) to `TourForm`, which
opens at once and runs one lookup per field through `useSwisstopoFill(field)`:
- **Loading:** the field is emptied (its old value described the previous point), a spinner
  sits in its end edge and the placeholder reads "Loading from Swisstopo…".
- **Answer:** fills the field. **No answer** (timeout, error, nothing nearby, outside CH):
  empty field, placeholder "Not available from Swisstopo – enter manually".
- **Typed values win:** an `input` event marks the field as the user's and aborts its request
  (`AbortController`, same stale check as the search: `controller !== own`). A pick skips a
  field that holds a typed value. Seeded values (edit mode) and values the form filled
  itself still follow the next pick, as names already did.
- Removing a start/end point, a newer pick and unmount abort the request too.
- Both services take an optional caller `signal` (linked by hand, iOS < 17.4 lacks
  `AbortSignal.any`), stay silent on a caller abort, and wait 10 s instead of 5 s.
*Why typing, not focus, cancels:* focusing (tab, tap to read) adds no user data; an answer
landing 200 ms later still saves typing.
*Alternative:* keep the fetch in `map-page.vue` and pass status props + a cancel event down
through dialog and sheet — rejected: six props × two paths for state only the form needs.

## Risks / Trade-offs

- [Swisstopo height service down or overloaded] → checked 2026-10-19: the request is
  well-formed (documented `height?easting&northing&sr=2056`; decimals accepted; the same URL
  returns 200 while the backend is up). Over 4 min, 3 of 40 fresh points answered; the rest
  were 503 "no available server" (their ingress with no healthy backend), 502 or no answer in
  12 s. `profile.json` fails the same way, so it is no fallback. CloudFront caches an error for
  ~1–10 s, so an immediate retry of the same URL gets the same error. The form degrades to the
  manual-entry placeholder (D8); nothing to fix on our side.
- [Saving while the elevation is still loading] → the tour saves without it; the request is
  aborted with the form. Accepted: the user chose not to wait, and can edit it in later.
- [GeoAdmin search unavailable or slow] → 5 s timeout, error message in the list; picking by
  panning keeps working.
- [Search result kinds come from the service ("Alpiner Gipfel", "Building")] → shown as data,
  not UI copy; GeoAdmin localizes them per `lang`. A German kind with a real "ue" after a
  consonant would gain a wrong "ü" (D2) — none exists today.
- [Jump with `padding: 0` resets padding that `frameTour` set] → every later framing call passes
  its own padding already; confirm reads `unproject`, so nothing depends on stale padding.
- [Hand-drawn glyphs look off next to Material icons] → render both at sm/md/lg next to
  `downhill_skiing`/`snowboarding` in a screenshot for user sign-off before merge.
- [Info-sheet tests target removed classes] → update selectors in the same task group as the
  template change.
