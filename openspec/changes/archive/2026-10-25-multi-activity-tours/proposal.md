# Proposal

## Why

User feedback (#335): the same objective is often planned for more than one activity — a
summit done as a ski tour in winter and a hike in summer, or a climb with a paraglide
down. Today a tour carries exactly one `tour_type`, so users either duplicate the tour or
drop an activity, and filters, map colours and link suggestions miss the other one.

User feedback (#338): multi-day and multi-part endeavours — valley → hut on day one, hut →
summit → valley on day two, or hiking up and paragliding down — are planned today as
unrelated tours. Nothing ties them together, so the map shows scattered markers and the
plan as a whole (its order, its span, its tracks) is invisible.

## What Changes

- **Several activity types per tour.** `tours.tour_type text` becomes
  `tours.tour_types text[]` (not null, default empty), each element constrained to the
  existing type list. Existing tours migrate to a one-element list (or empty). The domain
  `Tour` / `TourDraft` carry `tourTypes: TourType[]` in the picker's canonical order; the
  first entry is the tour's *primary* type for single-icon surfaces.
- **Multi-select type picker.** The tour form's activity chips toggle independently (create,
  edit and suggest).
- **Split map markers.** A tour whose types span several colours renders its goal, start/end
  and draft markers as a circle split evenly between those colours. Cluster pies weight each
  tour by its colours (a two-colour tour adds half to each slice) while the count stays the
  number of tours. Spiderfied leaves and cluster tween dots split the same way.
- **Fading GPX track.** A multi-colour tour's track cycles through its track colours along
  its length with a smooth fade between bands; single-colour tracks look unchanged.
- **Filters match any type.** The activity-type filter keeps a tour when *any* of its types is
  selected.
- **Display.** The detail fact strip lists every type; list avatar, detail hero badge, tint
  and calendar entries use the primary type; a suggestion row shows the proposed type list.
- **Linking uses overlap.** Two tours are the same objective when they share *at least one*
  activity type (plus the unchanged distance / visibility / friendship rules). A type edit
  evicts a linked tour only when it no longer shares a type with every other member, so
  adding a second activity never breaks a link.
- **Suggestions.** The `tour_type` suggestion field now carries the full type list; accepting
  it replaces the list. Pending rows are migrated.
- **Stale clients keep working (compat).** The write RPCs keep the old `p_tour_type` argument
  next to the new `p_tour_types`, and both views keep a `tour_type` column (= primary type),
  so a not-yet-updated PWA can still save and replay its offline queue without wiping types.
  The new client lifts a legacy `tourType` from cached snapshots and queued drafts.
- **Outings made of segments (#338).** Individual tours can be grouped into an *outing*;
  each tour becomes a numbered *segment* (its own goal, dates, activities, track). Segments
  of one outing may share an activity (hut to hut) or not (hike up, fly down). Membership,
  the outing's name and the segment order are stored on the tour row.
  - **Add segment** from a tour's detail or the outing overview: pick a new goal on the map
    (the form is seeded from the previous segment: start where it ended, same day, same
    activities, partners and visibility) or add one of the user's existing standalone tours.
  - **Outing overview:** tapping a segment's marker or the outing's list row opens the whole
    outing — name, date span, numbered segment timeline — and frames every segment on the map
    with numbered markers and all tracks. The owner can rename, reorder and remove segments.
  - **Segment view:** a segment opens in the normal tour detail with a navigator (outing
    name → overview, previous / next segment); the map shows that segment like any single
    tour — only its own markers and track.
  - **List:** the tour list shows one row per outing instead of its segments; search also
    matches the outing name.
- **Release note** `2026-10-multi-activity-search` announcing outings, multiple activities
  per tour, location search in the picker (#347) and the compact tour detail (#347) — the
  big changes since the last note.

## Capabilities

### New Capabilities

- `tour-outings`: grouping tours into outings of ordered segments — data model, add / rename /
  reorder / remove, overview, segment navigator, map focus, list rows, offline behaviour.

### Modified Capabilities

- `tour-extended-model`: "Tour type enum" becomes a type *list* per tour; `TourDraft` carries
  `tourTypes`.
- `tour-form-extended`: activity chips are a multi-select.
- `map-integration`: marker colour rule covers split markers and cluster weighting; draft
  preview follows the selected type list.
- `gpx-tracks`: track colour fades between the tour's track colours.
- `tour-list-view`: activity filter matches any type; row avatar uses the primary type.
- `tour-collision-handling`: predicate uses type overlap.
- `tour-linking`: group invariant, save-scan scenario and edit-warning rule use type overlap.
- `shared-tour-notifications`: collision scan restates the overlap predicate.

## Impact

- **DB:** a second migration adds `outing_id` / `outing_name` / `outing_position` to `tours`,
  recreates both views and both write RPCs (trailing `p_outing jsonb`, stale callers keep
  membership); new pgTAP suite `tour_outings.sql`; seed gains one outing.
- **DB (activities):** one migration — column swap + backfill, CHECK, `tours_view` / `friend_tours_view`
  recreated (grants re-issued), `create_tour_full` / `update_tour_full` re-created with the
  new argument (grants re-issued), collision / backfill / eviction / void / meaningful-change
  / suggestion functions rewritten, pending `tour_type` suggestion values converted. Seed and
  `notifications_rls.sql` pgTAP updated.
- **Frontend (outings):** outing domain helpers, tours store outing actions, map store
  selection, marker layer focus + segment badges, multi-track GPX layer, outing overview
  sheet, segment navigator, add-segment view, list grouping, map page wiring, form create
  mode keyed on `tourId`.
- **Frontend (activities):** tour schemas + entity, repository, tours store (cache hydrate + replay),
  tour form, filters, list row, info sheet, fact rows, suggestion diff/row, calendar
  components, collision notice, map store + marker layer + pie marker + spiderfy + GPX layer.
- **Release notes + i18n** (`en`, `de-CH`).
- **Deploy order:** migration first, frontend second (stale clients keep working through the
  compat argument/column). Worker untouched.
