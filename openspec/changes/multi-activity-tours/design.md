# Design

## Context

`tours.tour_type` is a nullable `text` with a CHECK list. It is read by both views, written by
`create_tour_full` / `update_tour_full`, and compared by 11 more SQL functions (collision
predicate, scans, backfill lists, eviction/void triggers, meaningful-change check, suggestion
serializer/apply). The client maps it to `tourType: TourType | null`, which drives a
data-driven `match` colour expression on the MapLibre circle layers, the cluster pie counts
(HTML SVG markers), the GPX `line-color`, filters and every icon/tint surface.

Offline: tour snapshots in IndexedDB and queued drafts in the outbox are structured-cloned
with no schema parse on read, so a snapshot written by the old build hydrates as-is. Replay
dead-letters an entry after 5 failed attempts. The PWA uses `registerType: 'prompt'`, so a
stale build can keep running (and replaying) after the migration lands.

Only three distinct marker colours exist (winter blue, paragliding amber, summer red); the
track and preview palettes follow the same grouping.

## Goals / Non-Goals

**Goals:** a type list per tour end to end; split markers and pies; fading tracks; any-type
filter; overlap-based linking; no data loss for stale clients or old offline data.

**Goals (#338):** group existing or new tours into an outing of ordered segments; see the
whole outing on the map and in one sheet, step through its segments; manage it (add, rename,
reorder, remove) without a new screen; offline and stale clients keep working.

**Non-Goals (#338):** outings across owners (a shared outing with friends — linking stays per
tour), an outing-level GPX, drag-and-drop reordering, outings in the calendar (segments show
there as the tours they are), partner notifications for outing edits.

**Non-Goals:** a user-chosen "main" activity (primary = first in canonical order); per-type
seasons, equipment or GPX tracks; splitting the list avatar / calendar chips / hero badge
(they keep one icon — the primary type); removing the compat shims (follow-up).

## Decisions

**D1 — Column `tour_types text[] not null default '{}'`, canonical order.** One column, no
separate "primary" column (one source of truth). CHECK `tour_types <@ array[…]` keeps values
valid. The client always writes the list in `TOUR_TYPE_VALUES` order (the picker builds it by
filtering that list), so array equality in `fn_is_meaningful_tour_change` and the suggestion
staleness check is order-stable. Distinctness is a client invariant, not a DB constraint (a
CHECK cannot use a subquery; a duplicate would only double a slice). *Alternative:* keep
`tour_type` as primary + `extra_types[]` — two sources for one fact, rejected.

**D2 — Compat for stale builds (migration ships first).** Both write RPCs keep
`p_tour_type text default null` and gain a trailing `p_tour_types text[] default null`:
- create: `coalesce(p_tour_types, array_remove(array[p_tour_type], null))`.
- update: `coalesce(p_tour_types, case when p_tour_type is not distinct from
  v_old.tour_types[1] then v_old.tour_types else array_remove(array[p_tour_type], null) end)`
  — an old client echoing the primary type keeps every type.
- Both views keep `tour_types[1] as tour_type` so the old client still sees (and echoes back)
  the primary type instead of null — without it every stale-client edit, even a
  completed-toggle, would wipe the types.
A clean break would make stale clients' writes fail with PGRST202 and dead-letter their
offline queue after ~1 min of retries. The shims are marked `ponytail:` with the cleanup path
(drop `p_tour_type` and the view column once no pre-#335 build is in the field).

**D3 — Client legacy lift.** `withTourTypes()` (tours domain) turns an object carrying a
legacy `tourType` and no `tourTypes` into `{ tourTypes: [tourType] | [] }`. Applied where
unparsed old data enters: the `tours:` / `friend-tours:` cache hydrate and the tour replay
handler's `payload.draft` / `baseSnapshot`. Online fetches always parse through zod and
never need it.

**D4 — Linking = overlap (`&&`).** `fn_collision_predicate`, `fn_scan_collisions_for_tour`,
`fn_scan_backfill_collisions`, `list_*_backfill_pairs`: `a.tour_types && b.tour_types`
(empty overlaps nothing, matching the old "null matches nothing"). Eviction on a type edit
mirrors the goal rule: evict iff the edited tour no longer overlaps *some* sibling. The client
mirrors (`collision-notice`, info-sheet `wouldEvict` / `pendingRequestsBrokenBy`) share one
`sharesActivity(a, b)` helper in `domain/collision.ts`.

**D5 — Suggestions keep the logical field `tour_type`, value becomes a JSON array.** Fields
are logical, not columns (`dates`, `goal`), so the CHECK constraint and its drift test stay
untouched. `tour_field_value` serializes the list; `fn_apply_tour_suggestion` accepts an array
(and, for a stale client's scalar, a one-element list). The migration rewrites `value` and
`base_value` of existing `tour_type` rows to arrays so staleness comparisons hold.

**D6 — Split circles = transparent circle + pie symbol overlay.** The circle layers stay
(hit-testing, selected stroke, filters, transitions). A feature gets a `pieKey` property
(`pie:#1565C0,#DC2626`) only when its types map to ≥2 distinct colours; for those the circle
fill becomes transparent and a symbol layer directly above draws the pie image. Images are
drawn on a canvas on demand in a `styleimagemissing` handler (synchronous, so no flash) at the
largest radius and scaled by `icon-size`; they survive no style switch, so the handler simply
redraws them. Overlays exist for the regular, selected, detail and preview circles; the
regular/selected overlays reuse the circle layers' filters plus `has pieKey`. The GeoJSON
`tourType` property stays as the *primary* type so every existing `match` (glyph tints,
fallback colours) keeps working unchanged. *Alternative:* HTML markers for split tours —
would duplicate selection, completion, friend/link glyph and transition styling.

**D7 — Cluster pies weighted per colour.** Counts are keyed by colour: each tour adds
`1 / distinctColours` to each of its colours; `total` stays the tour count. `buildSlices`
takes colour-keyed counts directly, so the type→colour palette argument goes away.
Spiderfy leaves and tween dots use a CSS `conic-gradient` for split tours.

**D8 — Track = `line-gradient` on `line-progress`.** `line-gradient` cannot be data-driven,
so each track gets its own source + layer and its gradient via `setPaintProperty` (sources get
`lineMetrics: true`); an outing draws several (D16). For n distinct colours the line is cut into `3n` equal bands; each holds
its colour for 60 % and fades into the next over the remaining 40 %. One colour → a constant
gradient (identical to today). `ponytail:` fixed band count — bands get long on very long
tracks; switch to distance-based bands if that reads badly.

**D9 — Primary type for single-icon surfaces.** List avatar, hero badge + tint, calendar
icons/colours and the start/end glyph tints use `tourTypes[0]`. The detail fact strip shows
one row per type; the seasons Gantt label joins all type labels.

**D10 — Release note `2026-10-multi-activity-search`** (since 2026-10-20) with four
highlights: outings made of segments (#338), several activities per tour, location search in
the picker (#347), compact tour detail with ski-touring icons (#347). Notes are not backfilled, so this one also carries the
#347 features that shipped without a note.

### Outings (#338)

**D11 — Outing fields live on the tour row.** `tours` gains `outing_id uuid`, `outing_name
text` (< 100 chars, like `name`) and `outing_position int`; CHECKs keep id and position
together and forbid a name without an id. An outing exists while a tour carries its id — no
table, so no new RLS, grants or friend read path: a friend sees a segment's outing fields
exactly when they see the segment, unpartnered like `name`. Rename and reorder touch every
segment (a handful of rows). *Alternative:* a `tour_outings` table — atomic rename, but a
friend-select policy, a view join and a second write path with its own offline kind; rejected
as more code for a display name.

**D12 — One write path: the tour draft.** Both write RPCs gain a trailing `p_outing jsonb
default null`. `null` = the caller predates outings (stale build or a pre-#338 queued draft):
update keeps the membership, create makes a standalone tour. `{}` = standalone.
`{"id","name","position"}` = segment. Membership therefore queues, coalesces, LWW-checks and
replays through the existing `tour` replay kind — the outbox is keyed per entity, so a separate
outing kind for the same tour id would collide. Client side `TourDraft.outing` is optional:
`undefined` = keep (the form never touches it), `null` = leave the outing. Outing fields are not
a meaningful change (no partner notification); the suggestion-void trigger only watches
visibility.

**D13 — Explicit order.** Segments sort by `outing_position`, then id. A new segment appends
(max + 1); reorder swaps two positions (two writes); gaps are harmless (badges number the
sorted list 1…n). Dates do not order segments: a same-day hike + flight, or an undated plan,
needs a stable order.

**D14 — An outing is keyed by owner + id, and needs two segments.** A friend can read an
outing id and could copy it onto their own tour; keying by `userId/outingId` keeps that tour
out of the other user's outing. A group with one visible segment renders as a plain tour
(e.g. a friend sees only one non-private segment). When a removal would leave one segment,
the client also clears that last one, so no single-segment outing is left behind.

**D15 — Selection: overview and segment.** The map store gains `selectedOutingKey`
(overview), mutually exclusive with `selectedTourId` (segment). Tapping a segment marker or
the outing's list row opens the overview; a segment row opens the segment's tour detail with
a navigator (outing name → overview, ‹ › → neighbour). Back from a segment opened in the
overview returns to it; the overview's own back follows its origin (the list).

**D16 — Map focus.** The focused outing is the overview's or the selected segment's. Its
segments are pinned out of clustering, wear a white ring and a numbered badge — a canvas image
drawn on `styleimagemissing` like the pies (raster base styles have no glyphs). Every segment's
track is drawn; in segment view the others are dimmed. A generation counter drops a track
that resolves after the selection moved on. The overview frames all segments' goals, starts
and ends beside the sheet.

**D17 — Add segment.** An in-sheet view (owner, from a tour's footer or the overview) offers
"pick a new goal on the map" or the owner's standalone tours. A new segment's form is seeded
from the last segment: same activities, partners, visibility, seasons; date = its last day;
start = its end point, else its goal (name + elevation copied). The outing is minted on save:
the anchor joins first, then the new tour is created into it — cancelling never leaves a
one-segment outing. The form's create mode is keyed on a missing `tourId` instead of a missing
`initialDraft`, so a seeded create still stages attachments.

**D18 — List rows.** After search and filters, segments collapse into one outing row at the
position of the first match; the row shows when any segment matches. Search also matches the
outing name. The row's avatar is the conic split of the segments' colours with the outing glyph;
its subtitle gives the segment count and the date span.

## Risks / Trade-offs

- **Rename is N writes.** A failure midway leaves mixed names; the outing shows the first
  segment's name and a second rename fixes it.
- **Full-row draft for outing edits.** Reorder / rename / remove write the whole segment from
  the client's snapshot (as the completed toggle already does); a stale snapshot could undo a
  concurrent edit from another device. Same exposure as today's toggles.

- **Stale clients narrow nothing but can't add types** — they only know one type. Acceptable;
  they are prompted to update.
- **Canonical order is a client invariant.** A third-party write in another order would make
  `fn_is_meaningful_tour_change` see a change and notify partners once. Low risk: the RPCs are
  the only writers and the app is the only client.
- **Pie overlays add four symbol layers.** Symbols with `icon-allow-overlap` /
  `icon-ignore-placement` render with the circles; no collision cost.
- **Deploy order:** `supabase db push` first, then merge the frontend. The new frontend
  against the old DB would read no types and its writes would fail — never ship the frontend
  first.
