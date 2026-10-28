# Proposal

## Why

Partners plan by difficulty ("T3 max", "nothing above S2") and by who is going, but the tour list
can filter neither: grades (added by `smarter-tour-creation`) are only searchable as text, the
Friends tab cannot narrow to the friend who recorded a tour, and its partner filter never matches
at all — friend tours carry no contact ids, so any partner chip empties the list. The map ignores
the list's filters, so a narrowed list and a full map disagree. Issues #351 and #362.

## What Changes

- **Grade filter** in the filter panel: one chip row per closed scale (SAC hiking T1–T6, SAC
  alpine L–EX, singletrail S0–S5), picked as a range (first tap one grade, second tap widens).
  A modifier keeps its base grade (ZS+ is ZS); free-text grades ("5c") never match a range.
- **Recorded-by filter** on the Friends tab: one chip per friend who shared a tour, by the name the
  viewer saved them under.
- **Friends-tab partner filter fixed**: its chips are the registered partners on friend tours
  (the viewer as "Me"), matched by user — today it matches nothing.
- **Map follows the list**: while the tour list is open and its search or filters narrow the active
  tab, the map shows only the tours the list shows (an outing row keeps all its segments).
- **Filter panel scroll fix**: with the panel open over a long list, scrolling ends at the last
  filter group instead of running on through blank space the height of the hidden rows.
- **Friend's tours from a contact**: a friend's contact detail offers "Show tours", which opens the
  tour list on the Friends tab filtered to that friend.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tour-list-view`: grade and recorded-by filters, Friends-tab partner filter semantics, filter
  count badge, panel scroll ending with its content, opening the list filtered to one friend.
- `map-integration`: tour markers follow the tour list's search and filters while the list is open.
- `contacts`: a friend's contact detail offers an entry point to that friend's tours.

## Impact

- Frontend only — no migration, no RPC, no Worker change. Grades, owner ids and partner user ids
  are already on every loaded tour (`friend_tours_view` exposes `user_id` and, to partners,
  `partner_names`).
- Code: `features/tours` (grade model, `use-tour-filters`, filter panel + new grade range
  component, list sheet), `features/map` (map component, map page), `features/contacts` (detail
  view, list sheet). Locales `en.json`, `de-CH.json`.
- Non-partner friend tours keep getting no map marker (`map-integration`); narrowing the map to
  the Friends tab shows only the listed tours the viewer is a partner on.
