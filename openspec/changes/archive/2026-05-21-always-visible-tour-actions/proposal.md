## Why

Browsing existing tours and adding new ones is the primary value of TourenBuddy, but both actions are currently buried inside the bottom-right speed dial — users must open the menu twice to reach them. Mirroring the White Risk layout, the two tour actions belong as always-visible buttons over the map. Issue [#169](https://github.com/sekael/touringbuddy/issues/169).

## What Changes

- Add a persistent bottom-center action bar over the map with two FAB buttons: **tour list** and **add new tour**. Identical position on mobile and desktop.
- **BREAKING (UX):** Remove the `tours` and `add-tour` entries from the speed dial menu. Speed dial keeps: feedback, base-map, profile, contacts.
- Wire the new add-tour button into the existing location-pick → tour-creation-dialog flow.
- Add an "add tour" button at the top of the tour list sheet that starts the same creation flow (closes the list first).
- Tour info sheet has no add button.
- Visibility / enabled state rules for the bottom-center action bar:
  - Hidden entirely while the tour list sheet or tour info sheet (side drawer) is open.
  - Hidden while a location pick is in progress (existing overlay-hide behaviour applies).
  - Visible-but-disabled while any other overlay is open (feedback, profile, contacts, friend-requests, tour-creation dialog without active pick).
  - Visible and enabled otherwise.
- Mutual-exclusion rule made explicit: while any top-level interaction is active, the speed dial trigger and all FABs other than the active one SHALL be disabled. Only one top-level UI surface is interactive at a time.

## Capabilities

### New Capabilities

- `tour-action-bar`: Persistent bottom-center FAB pair on the map for opening the tour list and starting tour creation, with visibility and enabled-state rules covering all overlay/picking states.

### Modified Capabilities

- `map-integration`: Speed dial menu items shrink to `{ feedback, base-map, profile, contacts }`; tours and add-tour move to the new action bar. Speed-dial trigger SHALL be disabled while any non-map overlay is open.
- `tour-list-view`: Tour list sheet exposes an "add tour" affordance at the top of the list that starts the creation flow.

## Impact

- `src/features/map/presentation/pages/map-page.vue` — mount the new `TourActionBar`, derive visibility/enabled from `activeOverlay` + `isPickingLocation`, route `add-tour` clicks into the existing pick → dialog flow.
- `src/features/map/presentation/components/tour-action-bar.vue` — new component.
- `src/features/map/presentation/components/map-action-overlay.vue` — disable speed-dial trigger while a non-map overlay is open.
- `src/features/map/presentation/composables/use-map-overlay.ts` — drop `tours` and `add-tour` from `menuItems`; remove their handlers.
- `src/features/tours/presentation/components/tour-list-sheet.vue` — add top-of-list "add tour" button; emit event that the page routes into the creation flow.
- `src/core/i18n/locales/en.json`, `de-CH.json` — reuse `map.overlay.tours` / `map.overlay.addTour`; add `map.actionBar.*` keys for aria-labels/tooltips if needed.
- Tests: cover visibility/enabled matrix for the action bar and the new list-sheet button.
- No DB / migration impact.
