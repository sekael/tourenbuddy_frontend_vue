## Why

After saving a new tour, the creation dialog closes and the user sees no confirmation or follow-up — the new tour's marker appears somewhere on the map, but the user must locate and tap it to inspect or edit details. Opening the info sheet and centering the map on the new tour closes the loop and matches the expected mental flow of "I just made this, show it to me."

## What Changes

- After successful tour creation, auto-select the new tour so its info sheet opens.
- Map flies to the new tour's goal location (reuses existing `flyToSelectedTour` logic on `selectedTourId` watcher).
- `toursStore.createTourFromDraft` returns the new tour id so the caller can select it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tours`: creation flow now auto-selects the created tour.

## Impact

- `src/features/tours/presentation/stores/tours-store.ts` — return type of `createTourFromDraft`.
- `src/features/map/presentation/pages/map-page.vue` — `handleTourCreated` selects new tour id after save.
- Tests: `test/features/tours/presentation/stores/tours-store.spec.ts` if it asserts return type.
- No API, schema, or repository changes.
