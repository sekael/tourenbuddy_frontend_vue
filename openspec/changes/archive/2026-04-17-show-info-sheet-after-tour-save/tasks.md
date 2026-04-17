## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/68-auto-open-info-sheet-after-save`

## 2. Store changes

- [x] 2.1 In `src/features/tours/presentation/stores/tours-store.ts`, change `createTourFromDraft` to return `Promise<string | null>` — return the generated `id` after `loadTours()` resolves, and `null` when unauthenticated.
- [x] 2.2 Update the store's exported return type if explicitly typed.

## 3. Map page wiring

- [x] 3.1 In `src/features/map/presentation/pages/map-page.vue` `handleTourCreated`, capture the id returned by `toursStore.createTourFromDraft(...)`.
- [x] 3.2 After successful creation, call `mapStore.selectTour(newId)` when `newId` is non-null. Rely on existing `selectedTourId` watchers to open the info sheet and fly to the tour.
- [x] 3.3 Reset `pendingLocation` and dialog pre-fill refs as today.

## 4. Tests

- [x] 4.1 Update `test/features/tours/presentation/stores/tours-store.spec.ts` (or the equivalent file) to assert `createTourFromDraft` resolves with the generated id and with `null` when unauthenticated.
- [x] 4.2 Add/adjust test covering `handleTourCreated` flow: after save, `mapStore.selectedTourId` equals the new tour id. If no map-page component test exists, cover via store-level test of the id return contract only.

## 5. Manual verification

- [x] 5.1 `npm run dev` — create a new tour; verify info sheet opens for the new tour and map flies to its goal with zoom 12.
- [x] 5.2 Verify cancelling the dialog leaves no overlay open (unchanged behavior).

## 6. Finalize

- [x] 6.1 Run `npm run lint` and `npm run format` — zero warnings.
- [x] 6.2 Run `npm run type-check` and `npm run test` — all pass.
- [x] 6.3 Prompt user to commit with the ready-to-copy message: `feat(tours): auto-open info sheet after saving new tour (#68)`
- [x] 6.4 Prompt user to push branch and open a PR targeting `main`, linking issue #68.
