## 1. Git Setup

- [x] 1.1 Fetch latest main and create branch: `git fetch origin && git checkout main && git pull && git checkout -b feat/67-tours-list-view`

## 2. Filter composable

- [x] 2.1 Create `src/features/tours/presentation/composables/use-tour-filters.ts` exposing reactive `searchQuery`, `filters` (partner IDs Set, tour types Set, seasons Set, `{ from, to }` date range, completion `'all' | 'done' | 'open'`), a `computed` `filteredTours` joining `useToursStore.tours` with partner names from `useContactsStore`, an `activeFilterCount` computed, and a `clearAll()` action
- [x] 2.2 Implement search predicate: case-insensitive substring match against `tour.name` and resolved partner full/display names; empty query is neutral
- [x] 2.3 Implement filter predicates per spec (partner intersects, tour-type in set, seasons intersects, planned-date inclusive range excluding null dates when a bound is set, completion tri-state)
- [x] 2.4 Add unit tests at `test/features/tours/presentation/composables/use-tour-filters.test.ts` covering every scenario in `specs/tour-list-view/spec.md` (including unnamed-tour + partner-with-no-contact edge cases)

## 3. Tour list sheet component

- [x] 3.1 Create `src/features/tours/presentation/components/tour-list-sheet.vue` using `<script setup lang="ts">` and `AdaptiveOverlay` with title "Tours", emitting `close`
- [x] 3.2 Render search input, collapsible "Filters" trigger with active-count badge, and the tours list styled to mirror `ContactsListSheet` rows (avatar/initial, name, partner subtitle, chevron)
- [x] 3.3 Wire row click to `mapStore.selectTour(tour.id)` then `emit('close')`
- [x] 3.4 Render loading state, empty-no-tours state, and filtered-empty state with "Clear filters" action
- [x] 3.5 Implement filter controls: partner multi-select (sourced from `useContactsStore`), tour-type multi-select, season multi-select, planned-date from/to inputs, completion tri-state segmented control
- [x] 3.6 Keep the component under ~150 lines — extract sub-components (`tour-list-row.vue`, `tour-filters-panel.vue`) if it grows past the limit
- [x] 3.7 Add component tests at `test/features/tours/presentation/components/tour-list-sheet.test.ts` using `createTestingPinia()` covering: open with tours, loading, empty, filtered-empty + clear, row click calls `selectTour` and emits `close`

## 4. Map action overlay + map page wiring

- [x] 4.1 In `src/features/map/presentation/components/map-action-overlay.vue`, add a `Tours` FAB (Material Symbols `location_on`) positioned between the Contacts FAB and the New Tour FAB; add `openTours: []` to the emits type and a click handler that emits it; ensure it is hidden via the existing `v-if="!isPickingLocation"` wrapper
- [x] 4.2 In `src/features/map/presentation/pages/map-page.vue`, extend `OverlayName` with `'tours'`, add a `showToursList` computed, handle `@open-tours="openOverlay('tours')"` on `MapActionOverlay`, and mount `TourListSheet` inside the overlay container with `@close="closeOverlay"`
- [x] 4.3 Verify the single-active overlay policy: opening Tours closes any other open overlay; closing Tours clears `activeOverlay`

## 5. Test + lint

- [x] 5.1 Run `npm run test` and ensure every new + existing test passes
- [x] 5.2 Run `npm run type-check`
- [x] 5.3 Run `npm run lint` and `npm run format`
- [ ] 5.4 Manual smoke test in `npm run dev`: open FAB, search, apply each filter, clear filters, select a tour and confirm `TourInfoSheet` opens and the map flies to the goal

## 6. Finalize

- [ ] 6.1 Prompt the user to review the diff, stage, and commit with this conventional-commit message:

  ```
  feat(tours): searchable, filterable tours list view

  Add a Tours FAB between the contacts and new-tour FABs that opens a
  searchable, filterable list of every tour for the current user.
  Search matches tour name and partner names; filters cover partner,
  activity type, season, planned date, and completion status. Selecting
  a row hands off to the existing TourInfoSheet flow.

  Closes sekael/tourenbuddy_frontend_flutter#67
  ```

- [ ] 6.2 Prompt the user to push the branch and open a PR against `main` with the issue link in the description
- [ ] 6.3 After merge, prompt the user to run the `openspec-archive-change` skill to archive this change
