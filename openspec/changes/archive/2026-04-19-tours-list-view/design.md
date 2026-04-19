## Context

Tours today are only discoverable via markers on the map. `useToursStore` already loads every tour for the authenticated user on bootstrap, and `useContactsStore` holds the partner names needed to display and filter on partners. The existing `ContactsListSheet` + `AdaptiveOverlay` pattern is the established UX for browsing a user's records, and `map-page.vue` already enforces a single-active overlay policy over a named `OverlayName` union.

## Goals / Non-Goals

**Goals:**

- Expose every tour of the current user in one searchable, filterable list.
- Mirror the Contacts list UX exactly — same overlay host, typography, row layout, empty/loading states — so the two features feel parallel.
- Keep interaction cheap: selecting a row routes through `mapStore.selectTour`, which already triggers `flyToSelectedTour` and opens `TourInfoSheet`.
- Keep filters purely client-side.

**Non-Goals:**

- Pagination or virtualization (deferred — user tour sets are small).
- Saved filter presets, URL-encoded filter state, or deep-linking to filtered views.
- Sorting controls (list stays in store order; can be added later).
- Editing or deleting tours from within the list (handled in the existing info sheet).
- Multi-select / bulk actions.

## Decisions

**1. New overlay name `'tours'` registered in `map-page.vue`.**
Rationale: `map-page.vue` already centralises overlay arbitration via `OverlayName` and `activeOverlay`. Threading the tour list through the same machinery preserves the unified single-active policy so the list auto-closes when another overlay opens. Alternative: a local `ref` scoped to `MapActionOverlay`. Rejected — would bypass the established policy and risk two overlays open at once.

**2. FAB icon = `location_on`.**
Per issue and maintainer direction. Sits between Contacts (`group`) and New Tour (`add_location_alt`); the `location_on` / `add_location_alt` pair reads as "browse locations" vs "add location".

**3. Search + filter state lives in a feature composable `use-tour-filters.ts`, not in the Pinia store.**
Rationale: filter state is purely presentational and session-scoped. Promoting it to the store would pollute the domain layer. The composable exposes reactive `searchQuery`, `filters`, and a `computed` `filteredTours` derived from `toursStore.tours` + `contactsStore.contacts`. Tests can instantiate it directly. Alternative: put it inside the component. Rejected — harder to unit-test and would grow the component past the 150-line conventions cap.

**4. Partner search and filter resolve partner _names_ via `useContactsStore`.**
`Tour.partnerIds` is opaque; searching on IDs would be useless. The composable joins each tour's partner IDs to contact names at filter time. If a partner ID has no matching contact (deleted contact), it is treated as the empty string — won't match name-based searches but won't crash.

**5. Season + activity-type filters use the existing enums (`Season`, `TourType`).**
Multi-select for both (season can be any of summer/winter/…; a tour may match if any of its seasons intersects the selected filter). A tour whose `seasons` is `null` matches only when the season filter is empty.

**6. Planned-date filter = optional `from` / `to` bounds (inclusive).**
Matches tours whose `plannedDate` falls inside the range. Tours with `plannedDate === null` are excluded when either bound is set, included when both are empty.

**7. Completion-status filter = tri-state: `all` | `done` | `open`.**
Matches `tour.completed` boolean. Default `all`.

**8. Row click: `mapStore.selectTour(tour.id)` then `emit('close')`.**
Existing behavior in `map-page.vue` already handles `selectedTourId → flyTo + open TourInfoSheet`. No new wiring needed.

**9. Empty states: two distinct messages.**

- No tours at all: mirror contacts empty state ("No tours yet. Create one from the map.").
- Tours exist but filters produce zero matches: "No tours match your filters." with a "Clear filters" action.

## Risks / Trade-offs

- **Large tour sets degrade naive filter perf** → Mitigation: filtering is O(n × partners) per keystroke; acceptable at current scale. Revisit with virtualization when tour counts exceed a few hundred.
- **Partner search depends on contacts being loaded** → Mitigation: `map-page.vue` already loads contacts on bootstrap; the filter gracefully treats missing contacts as empty names.
- **Filter UI real estate on mobile** → Mitigation: collapse filters behind a "Filters" disclosure button (filter-count badge on the trigger) so the default view shows only search + list, matching the contacts sheet visual density.

## Migration Plan

No data migration. Feature is additive. Rollback = revert the PR; no schema or store changes to undo.
