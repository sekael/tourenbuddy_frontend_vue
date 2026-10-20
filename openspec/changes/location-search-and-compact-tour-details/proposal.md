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
- **Grouped detail and two more activity glyphs:** the detail facts form groups (activity,
  route with the GPX download, partners, free texts, attachments, suggestions) split by thin
  dividers; climbing and mountaineering get their own glyphs instead of the shared landscape.
- **Swisstopo lookups no longer block (regression fix):** the tour form opens right after a
  pick; name and elevation fill in independently, each field showing a spinner while Swisstopo
  answers and a "enter manually" placeholder when it does not (10 s timeout, was 5 s). Typing
  in a field cancels its lookup, and a late answer never replaces what the user typed.

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
- `elevation-lookup`, `name-suggestion`: 10 s timeout and caller cancellation; auto-fill
  happens in the open form, per field, with loading/failed states and typed values protected.
- `tour-form-extended`: start/end point metadata is looked up by the form, not fetched before
  it opens.

## Impact

- **Code:** `features/map/presentation/components/location-picker.vue` (search UI),
  new `features/map/data/services/swisstopo-search-service.ts`, `map-page.vue` (name prefill
  handoff), `features/tours/presentation/components/tour-info-sheet.vue` (template + styles),
  `features/tours/data/models/tour-type.ts`, `core/components/icons.ts`, `vite.config.ts`
  (custom icon collection), `tour-form.vue` + `tour-creation-dialog.vue` (`pick` prop), new
  `features/tours/presentation/composables/use-swisstopo-fill.ts`, both Swisstopo services
  (`signal`, 10 s), new `src/assets/icons/*.svg`, both locale files.
- **External API:** `api3.geo.admin.ch/rest/services/api/SearchServer` (free, no key, CORS
  enabled) — same host as the existing height/identify calls.
- **No** DB, Worker, or dependency changes. Guided tour targets unaffected.
- **Tests:** search service (parsing, label stripping, abort), picker search behaviour,
  info-sheet test selectors that reference removed sections.
