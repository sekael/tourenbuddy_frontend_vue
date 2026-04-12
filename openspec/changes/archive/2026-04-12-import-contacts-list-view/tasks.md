## 1. Git Setup

- [x] 1.1 Continue on existing branch `feat/62-contact-phone-integration` (this change extends the same feature)

## 2. Dialog State + Import Results

- [x] 2.1 Add `viewState` ref (`'form' | 'import-results'`), `ImportResult` interface (`firstName`, `lastName`, `phoneNumber`, `status: 'imported' | 'skipped'`), and `importResults` ref to `contact-creation-dialog.vue`
- [x] 2.2 Refactor `handleFileChange` and `handleContactPickerImport` to populate `importResults` array and switch `viewState` to `'import-results'` after import
- [x] 2.3 Add `switchToForm()` function that resets `viewState` to `'form'`, clears `importResults` and form fields

## 3. Import Results Template

- [x] 3.1 Add `v-if="viewState === 'import-results'"` block with scrollable list rendering each `ImportResult` — show name, phone (if present), and "skipped" badge for duplicates
- [x] 3.2 Add "Add another manually" link/button calling `switchToForm()`
- [x] 3.3 Add "Done" button that emits `close`
- [x] 3.4 Wrap existing form in `v-else` (only visible when `viewState === 'form'`)

## 4. Styling

- [x] 4.1 Style import results list: scrollable container, list items with name/phone/status badge, consistent with dialog design tokens

## 5. Finalize

- [x] 5.1 Run `npm run lint` and `npm run format` — fix any issues
- [x] 5.2 Run `npm run test` — all tests pass
- [x] 5.3 Prompt user to commit with message: `feat(contacts): show import results list after contact import (#62)`
- [x] 5.4 Prompt user to push branch and create PR
