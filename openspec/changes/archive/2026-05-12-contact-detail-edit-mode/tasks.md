## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/135-contact-detail-edit-mode`

## 2. ConnectPrompt — `beforeSend` hook

- [x] 2.1 Add optional `beforeSend?: () => Promise<void>` prop to `src/features/friendships/presentation/components/connect-prompt.vue`
- [x] 2.2 In `handleSend`, `await props.beforeSend?.()` before `store.sendRequest`; on reject set `state = 'error'` with the thrown message and skip the `sendRequest` call
- [x] 2.3 Verify the existing `error-text` region renders the message and that Send/Just-save buttons re-enable for retry

## 3. ContactForm programmatic submit

- [x] 3.1 In `src/features/contacts/presentation/components/contact-form.vue`, extract submit logic into a function that returns `Promise<void>` and rejects on validation/persistence error
- [x] 3.2 `defineExpose({ submit })` so the manual-add caller can invoke it from the connect-prompt `beforeSend`
- [x] 3.3 Keep the existing form `<button>` click path calling the same function (no UI change)

## 4. ContactDetailView — view/edit mode

- [x] 4.1 Add `mode = ref<'view' | 'edit'>('view')`, `isSaving = ref(false)`, `saveError = ref<string | null>(null)` to `contact-detail-view.vue`
- [x] 4.2 Add `enterEditMode()`, `cancelEdit()` (re-seed name refs from `props.contact`, reset every `methodEdits[*]` to display value + label of `props.contact.contactMethods`, close `showAddMethod`, clear errors)
- [x] 4.3 Split current `saveName` into a `saveNameInternal()` that throws on error and does NOT `emit('back')`
- [x] 4.4 Implement `saveAll()`: returns boolean; iterates methods via `saveMethod`; calls `confirmAddMethod` if add-form has content; calls `saveNameInternal`; checks errors; on success sets `mode = 'view'`
- [x] 4.5 Template: view mode renders read-only spans + Edit button; edit mode renders inputs + form-level Save/Cancel; per-row Save buttons removed; Remove buttons shown in edit mode only
- [x] 4.6 Primary-phone selector rendered as inert `<span>` in view mode; interactive `<button>` in edit mode
- [x] 4.7 `defineExpose({ commitPendingEdits })` — resolves in view mode, calls saveAll + re-throws on failure in edit mode
- [x] 4.8 Existing watchers seeding `firstName`/`methodEdits` from `props.contact` continue to work

## 5. contacts-list-sheet wiring

- [x] 5.1 Add `detailRef` ref bound to `<ContactDetailView>`
- [x] 5.2 Pass `:before-send` to detail-view `<ConnectPrompt>` wired to `detailRef.commitPendingEdits`
- [x] 5.3 Add `addFormRef` ref bound to `<ContactForm>`
- [x] 5.4 Pass `:before-send` to manual-add `<ConnectPrompt>` wired to `addFormRef.submit`
- [x] 5.5 Import-results `<ConnectPrompt>` unchanged

## 6. i18n

- [x] 6.1 Added `editBtn`, `cancelBtn`, `saveBtn`, `saveFailed` to `src/locales/en.json` under `contacts.detailView`
- [x] 6.2 Added matching keys to `src/locales/de-CH.json`
- [x] 6.3 Keys referenced in `contact-detail-view.vue` via `t(...)`

## 7. Tests

- [x] 7.1 `test/features/friendships/presentation/components/connect-prompt.test.ts` — beforeSend resolves → sendRequest called; beforeSend rejects → sendRequest NOT called + error visible; no beforeSend → direct call; retry re-enables buttons
- [x] 7.2 `test/features/contacts/presentation/components/contact-detail-view.test.ts` — defaults to view mode; Edit enters edit mode; Cancel reverts; commitPendingEdits resolves in view mode; rejects on save failure; succeeds and returns to view mode
- [x] 7.3 Existing contacts-list-sheet tests still pass (72 test files, 717 tests)
- [x] 7.4 `npm run test` passes locally — 717/717

## 8. Sync Specs

- [x] 8.1 Merge delta specs from change into canonical specs:
      - View/edit mode requirement and scenarios → `openspec/specs/contacts/spec.md`
      - Pre-send hook and detail-view commit requirement → `openspec/specs/contact-account-linking/spec.md`
      - Manual-form hook requirement updated to include submission workflow

## 9. Finalize

- [x] 9.1 `npx eslint . --fix` — zero warnings
- [x] 9.2 `npm run type-check` passes
- [x] 9.3 Commit the spec-sync changes with the following conventional commit message (do NOT run `git commit`):
      ```
      docs(openspec): sync contact-detail-edit-mode delta specs to canonical specs
      ```
- [x] 9.4 Push the branch and create PR against `main` to finalize the change
