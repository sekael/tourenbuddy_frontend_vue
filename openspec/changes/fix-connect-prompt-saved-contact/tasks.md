## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b fix/158-connect-prompt-saved-contact`

## 2. ConnectPrompt prop

- [x] 2.1 Add `showDismiss?: boolean` prop with default `true` to `src/features/friendships/presentation/components/connect-prompt.vue`
- [x] 2.2 Wrap secondary button (`{{ t('friendships.justSaveContact') }}`) in `v-if="showDismiss"`

## 3. Expose detail-view mode

- [x] 3.1 Add `mode` to the existing `defineExpose` block in `src/features/contacts/presentation/components/contact-detail-view.vue` (keep `commitPendingEdits`)

## 4. Wire prop in contacts list sheet

- [x] 4.1 In `src/features/contacts/presentation/components/contacts-list-sheet.vue` add a `computed` reading `detailRef.value?.mode` (e.g. `detailMode`)
- [x] 4.2 Pass `:show-dismiss="detailMode === 'edit'"` to the `ConnectPrompt` at line ~412 (detail-view instance only — do NOT touch the import-results or add-form instances)

## 5. Tests

- [x] 5.1 Add component test under `test/features/friendships/presentation/components/connect-prompt.spec.ts`: when `show-dismiss=false`, dismiss button is not rendered; when omitted/true, both buttons render
- [x] 5.2 Run `npm run test` — all green

## 6. Finalize

- [x] 6.1 `npx eslint . --fix` and `npm run type-check` — zero warnings/errors
- [ ] 6.2 Prompt user to commit with message:
  ```
  fix(friendships): hide save-only btn on saved contact connect prompt

  Closes #158
  ```
- [ ] 6.3 Prompt user to push branch and open PR against `main` referencing issue #158
