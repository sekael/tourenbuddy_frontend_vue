## Why

Users have no way to browse or find their tours except by panning the map and clicking markers. Once the tour set grows, that becomes impractical. A searchable, filterable list — mirroring the existing contacts list UX — gives users direct access to every tour by name, partner, activity, season, date, or completion status. Tracks issue [sekael/tourenbuddy_frontend_flutter#67](https://github.com/sekael/tourenbuddy_frontend_flutter/issues/67).

## What Changes

- Add a new floating action button labeled "Tours" (Material Symbols `location_on` icon) to `MapActionOverlay`, positioned **between** the Contacts FAB and the New Tour (`add_location_alt`) FAB.
- Introduce a new `TourListSheet` component presented via `AdaptiveOverlay`, matching the look and interaction pattern of `ContactsListSheet` (desktop dialog / mobile bottom sheet via existing unified overlay policy).
- Include a search bar filtering on **tour name** and **partner name**.
- Include filter controls for: **partner**, **activity type (`tourType`)**, **season**, **planned date** (range), **completion status** (done / not done / all).
- Tapping a tour row selects it via `mapStore.selectTour(id)`, closes the list, and opens the existing `TourInfoSheet` with the map flying to the tour goal.
- Register the new overlay in `map-page.vue` under the unified single-active overlay policy (`OverlayName` extended with `'tours'`).
- No backend changes — filters and search run client-side over the already-loaded `useToursStore.tours`.

## Capabilities

### New Capabilities

- `tour-list-view`: Searchable and filterable UI over the authenticated user's tours, presented as an overlay reachable from a dedicated FAB on the map page.

### Modified Capabilities

- `map-integration`: `MapActionOverlay` gains a new "Tours" FAB and a new `open-tours` emit; `map-page.vue` registers a `'tours'` overlay name alongside the existing ones.

## Impact

- Code:
  - `src/features/map/presentation/components/map-action-overlay.vue` — new FAB + emit.
  - `src/features/map/presentation/pages/map-page.vue` — new overlay slot + open handler.
  - `src/features/tours/presentation/components/tour-list-sheet.vue` — new component.
  - `src/features/tours/presentation/composables/use-tour-filters.ts` — new composable for search/filter state + derived filtered list.
  - Tests under `test/features/tours/presentation/` mirroring structure.
- Stores: uses existing `useToursStore` and `useContactsStore`. No store API changes required.
- APIs / DB: none.
- Dependencies: none added.
