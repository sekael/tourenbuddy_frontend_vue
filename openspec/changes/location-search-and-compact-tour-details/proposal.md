# Proposal

## Why

User feedback (#339, #340): placing a new tour means panning/zooming across Switzerland to find a
known summit, and the tour detail view spends a lot of space on little information — a header
card, a full row of toggle buttons, three section headings and a card per fact. Ski tour and
splitboard tours also show a walking-with-poles glyph that reads as hiking, not ski touring.

## What Changes

- **Location search in the picker (#339):** while picking any location (tour goal, start, end —
  in creation and in edit mode) a search field docks at the bottom of the screen, above Cancel/Confirm. Typing queries the
  free Swisstopo GeoAdmin location search (summits, places, huts, addresses, postcodes); choosing
  a result flies the map there so the crosshair sits on it. The user can still pan to fine-tune
  before confirming, exactly as today.
- **Search result names the point:** when the user confirms without moving the crosshair more
  than ~50 m off the chosen result, the result's name prefills the tour name (goal) or the
  start/end point name instead of the radius lookup. Moving further falls back to today's lookup.
- **Search is online-only:** the field is hidden while offline; the picker itself keeps working.
- **Compact tour detail (#340):**
  - Hero line leads with the **goal**: type badge, goal elevation as the headline, planned date,
    goal coordinates beneath; the tour name stays the sheet title.
  - Owner completion/visibility toggles stay the **labelled button row**, directly below the
    hero (icon-only toggles in the hero were tried and read as unclear).
  - The activity type moves into a **wrapped fact strip** together with start and end.
  - Partners, seasons, description, equipment and notes render as **icon-led rows** — no
    section headings and no per-fact cards.
- **Ski-touring icons (#340):** two custom glyphs — an uphill skier on skins for `skitour` and
  a matching splitboarder for `splitboarding` — replace `nordic_walking` everywhere the tour type
  icon appears (type picker, list, detail, calendar). Bundled as in-repo SVGs through the existing
  icon registry; still no CDN or icon font.

## Capabilities

### New Capabilities

- `location-search`: searching a place by name while picking a map location — query rules,
  result list, camera jump, name prefill, offline behaviour.

### Modified Capabilities

- `design-system`: "Tour detail reads at a glance" is rewritten for the compact goal-first
  layout; "Material Symbols icon font" allows in-repo custom glyphs for subjects the Material set
  lacks.
- `tour-info-extended`: "Completion toggle control" describes the owner toggles row below the hero (the
  current text still describes a long-gone bottom-right action row).

## Impact

- **Code:** `features/map/presentation/components/location-picker.vue` (search UI),
  new `features/map/data/services/swisstopo-search-service.ts`, `map-page.vue` (name prefill
  handoff), `features/tours/presentation/components/tour-info-sheet.vue` (template + styles),
  `features/tours/data/models/tour-type.ts`, `core/components/icons.ts`, `vite.config.ts`
  (custom icon collection), new `src/assets/icons/*.svg`, both locale files.
- **External API:** `api3.geo.admin.ch/rest/services/api/SearchServer` (free, no key, CORS
  enabled) — same host as the existing height/identify calls.
- **No** DB, Worker, or dependency changes. Guided tour targets unaffected.
- **Tests:** search service (parsing, label stripping, abort), picker search behaviour,
  info-sheet test selectors that reference removed sections.
