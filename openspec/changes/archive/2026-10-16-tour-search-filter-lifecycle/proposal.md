# Proposal

## Why

Issue #322: on mobile the tour list bottom sheet is content-sized, so every keystroke in the search box shrinks the sheet as rows disappear. In the installed PWA the shrunken sheet ends up behind the on-screen keyboard, hiding the very results being searched. Separately, search text and filters survive closing the list, so the next time the user opens it they see a silently narrowed list.

## What Changes

- `BottomSheet` gains a `holdHeight` option: while set, content shrinking does not pull the sheet down (growing, dragging and viewport refits still work). When released, the sheet refits to its content.
- The tour list holds its sheet height while a search query or any filter is active.
- Closing the tour list (sheet/drawer close, dismissing it via the menu, switching to another overlay, or closing a tour detail opened from the list) clears the search query and all filters on both tabs. Opening a tour from the list and returning to it still keeps them. The last-viewed tab is still remembered.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bottom-sheet`: adds a requirement for holding the fit-content height.
- `tour-list-view`: adds requirements for stable sheet height during search/filter and for resetting search + filters when the list is left.

## Impact

- `src/core/components/bottom-sheet.vue` (new optional prop)
- `src/features/tours/presentation/components/tour-list-sheet.vue`
- `src/features/tours/presentation/composables/use-tour-filters.ts` (new `resetTourFilters` export)
- `src/features/map/presentation/pages/map-page.vue` (reset on leaving the list)
- Tests under `test/core/components/` and `test/features/tours/`
