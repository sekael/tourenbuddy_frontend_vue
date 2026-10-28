# Design

## Context

Filters live in `use-tour-filters.ts`: one module-level search + `TourFilters` state per tab
(`owned`, `friends`), a `matchesFilters` predicate, reset when the list is left (map page watch).
The panel (`tour-filters-panel.vue`) is a dumb view over that state, wired by
`tour-list-sheet.vue`. The map (`tourenbuddy-map.vue`) reads the tours store directly and feeds
`mapTours` (owned + partner friend tours, collision-shadowed) to the marker layer. Grades are free
text; `grade.ts` already parses them into the scale grade each part leads with (`gradeLeads`).
Friend tours carry `userId` (owner) and, for partner viewers only, `partnerNames[].userId`; their
`partnerIds` is always `[]`.

## Goals / Non-Goals

**Goals:** the filters in the specs, one predicate shared by list and map, no new data path.

**Non-Goals:** markers for non-partner friend tours; fitting the camera to the filtered tours;
grade filtering for climbing (two open scales) or free text; persisting filters across leaving
the list.

## Decisions

**D1 — Grade ranges as `{ from, to }` pairs, one per scale, in `TourFilters.gradeRanges`.**
Pure helpers in `grade.ts` next to the parser they depend on: `tapGradeRange` (the booking-calendar
pick: tap one, tap a second to widen, tap again to restart; tap a lone pick to clear) and
`gradeInRanges` (every part on a filtered scale within range, at least one such part). Ranges, not
sets: "T3 max" is two taps (T1, T3), and the stored shape *is* the user's sentence. A modifier
counts as its base grade because `gradeLeads` already canonicalises "zs+" → ZS — the same rule
that lights the form's chips. Alternative: per-grade toggles like the other chips — rejected, a
cap needs three to six taps and leaves holes ("T1, T3") nobody means.

**D2 — Friends-tab people filters by user id.** `ownerIds: Set<string>` is new; `partnerIds`
keeps its name and holds contact ids on My Tours, user ids on Friends — the predicate picks the
key per tab (`tour.partnerIds` vs `tour.partnerNames[].userId`). Chip options come from the tab's
tours, plus anything selected (so a filter set from a contact detail is always visible and
clearable). Labels use the existing resolvers: owner → `resolveFriendName` (fallback
`tours.list.aFriend`, the broken-link render); partner → contact name, else profile name, viewer →
"Me" — the info sheet's rule, so chip, row and detail never disagree. The people groups render
behind one settle gate (`ensurePhones` for their ids + contacts loaded): labels appear once, final.

**D3 — Map narrowing as a prop.** `useListedTourIds()` (in `use-tour-filters.ts`) returns the
active tab's listed ids — each matched tour plus all segments of its outing, mirroring the list's
outing rows — or `null` when nothing narrows. The map page passes it to `TourenbuddyMap` only
while `activeOverlay === 'tours'`; the map filters `tours` and partner friend tours by it *before*
collision shadowing, so a hidden owned tour no longer suppresses the friend tour at its spot.
Gating on the overlay, not on the filter state alone, keeps a stale module-level filter (left via
the calendar route, which unmounts the page without the reset watch) from ever thinning a bare
map. A tour or outing opened from the list owns the map anyway (map-integration), so nothing is
lost by not narrowing there. Alternative: the map imports the filter composable itself —
rejected, it would need to know which overlay is open.

**D4 — Panel scroll fix by clamping the list region.** On mobile the sheet's `.content` is the
one scroller and the absolutely-positioned panel covers `.list-region`, whose height is all the
rows — hence the blank run. While the panel is open, `.list-region` gets `max-height` = the
panel's measured content height (`useElementSize`), and the sheet holds its height
(`hold-height` also while open) so the clamp never shrinks it. Panel taller than the rows: the
clamp is a no-op and the panel scrolls inside as today. Alternative: put the panel in flow and
hide the rows — rejected, a short list would then grow the sheet on open (spec: expanding never
resizes it).

**D5 — Contact → tours.** `ContactDetailView` emits `showTours` (view mode, linked friend, not
blocked) → `ContactsListSheet` re-emits `showFriendTours(userId)` → the map page calls
`showFriendTours(userId)` from `use-tour-filters` (reset both tabs, switch to Friends, set
`ownerIds`) and opens the `tours` overlay. Contacts never touch the tours store; the map page,
which already owns both overlays, joins them.

## Risks / Trade-offs

- [Narrowing to the Friends tab can show fewer markers than rows: non-partner friend tours are
  listed but never marked] → specified explicitly (map-integration); revisit only with the
  partner-only marker rule itself.
- [Marker diff runs on every search keystroke] → the layer already diffs; tour counts are small.
- [`partnerIds` means two id kinds depending on the tab] → per-tab state never mixes; a comment at
  the predicate names it.
- [A friend with no shared tours opens to "No tours match your filters."] → truthful; the
  selected chip shows why and clears it.
