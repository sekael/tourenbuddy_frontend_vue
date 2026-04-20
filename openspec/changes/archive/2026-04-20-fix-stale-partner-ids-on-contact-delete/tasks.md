## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b fix/56-stale-partner-ids-on-contact-delete`

## 2. Tours Store Subscription

- [x] 2.1 In `src/features/tours/presentation/stores/tours-store.ts`, import `useContactsStore` from `@/features/contacts/presentation/stores/contacts-store`.
- [x] 2.2 Inside `defineStore('tours', () => { ... })` setup, instantiate `const contactsStore = useContactsStore()`.
- [x] 2.3 Register `contactsStore.$onAction(({ name, args, after }) => { ... })`. When `name === 'deleteContact'`, register an `after()` callback that reads the deleted id from `args[0]`.
- [x] 2.4 In the callback, short-circuit when no cached tour has the id in `partnerIds` (avoid replacing the array unnecessarily).
- [x] 2.5 When at least one tour is affected, set `tours.value` to a new array that maps affected tours to a new object with `partnerIds` filtered to exclude the deleted id; preserve other entries by reference and preserve relative order of remaining `partnerIds`.

## 3. Tests

- [x] 3.1 Create or extend `test/features/tours/presentation/stores/tours-store.test.ts` with a test that wires both stores via `createPinia()` (real Pinia, not testing pinia, so `$onAction` fires), seeds `tours.value` with two tours sharing one partner, calls `contactsStore.deleteContact(id)` (with the contacts repository mocked to resolve), and asserts the deleted id is gone from both tours.
- [x] 3.2 Add a test asserting that when `contactsStore.deleteContact` rejects, `tours.value` is unchanged (covers the failure path).
- [x] 3.3 Add a test asserting that deleting a contact not referenced by any tour leaves `tours.value` referentially equal (no churn).
- [x] 3.4 Add a test asserting that other fields on affected tours (e.g. `name`, `plannedDate`, `goal`) are preserved after reconciliation.
- [x] 3.5 Add a `tour-info-sheet.vue` component test verifying that calling `contactsStore.updateContact` on a partner contact updates the partner chip's displayed name on the next tick (no tours-store reconciliation involved).
- [x] 3.6 Add a `tour-info-sheet.vue` component test verifying that changing the primary phone of a partner contact via `contactsStore.setPrimaryPhoneOnContact` updates the action-menu target on the next tick.
- [x] 3.7 Add a static guard test for `Tour` Zod schema/entity asserting it does not contain partner snapshot fields (only `partnerIds`).

## 4. Verification

- [x] 4.1 Run `npm run test` — all tests pass.
- [x] 4.2 Run `npm run type-check` — no errors.
- [x] 4.3 Manual reproduction per issue #56: add contact → assign to tour → delete contact → edit & save same tour; verify `update_tour_full` payload no longer contains the deleted UUID and the save succeeds.

## 5. Finalize

- [x] 5.1 Run `npm run lint` and `npm run format` — zero warnings.
- [x] 5.2 Prompt the user to commit with this conventional commit message: `fix(tours): scrub deleted contact ids from cached partnerIds (#56)`.
- [x] 5.3 Prompt the user to push the branch and open a PR against `main` referencing issue #56.
