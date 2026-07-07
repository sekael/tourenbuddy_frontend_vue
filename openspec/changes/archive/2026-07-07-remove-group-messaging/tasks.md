## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b fix/200-remove-group-messaging`

## 2. Remove group SMS UI from tour info sheet

- [x] 2.1 In `src/features/tours/presentation/components/tour-info-sheet.vue`, remove the `GroupSmsConfirmDialog` import (line ~19)
- [x] 2.2 Remove the `showGroupSmsDialog` ref (line ~513)
- [x] 2.3 Remove the "Message all" `<BaseButton>` block (`v-if="partners.length > 1"`, lines ~805–812)
- [x] 2.4 Remove the `<GroupSmsConfirmDialog>` mount block (lines ~839–843)
- [x] 2.5 Remove the `.group-sms-btn` CSS rule (lines ~1116–1119)

## 3. Delete component and dead util

- [x] 3.1 Delete `src/features/contacts/presentation/components/group-sms-confirm-dialog.vue`
- [x] 3.2 In `src/features/contacts/core/utils/contact-actions.ts`, remove the `GroupSmsResult` interface and `buildGroupSmsRecipients` function; keep `buildContactActions` and `ContactAction`

## 4. Remove dead i18n

- [x] 4.1 Remove the `contacts.groupSms` block from `src/locales/en.json` and `src/locales/de-CH.json`
- [x] 4.2 Remove the `tours.infoSheet.messageAll` key from `src/locales/en.json` and `src/locales/de-CH.json`

## 5. Update tests

- [x] 5.1 Delete `test/features/contacts/presentation/components/group-sms-confirm-dialog.test.ts`
- [x] 5.2 In `test/features/contacts/core/utils/contact-actions.test.ts`, remove the `buildGroupSmsRecipients` import and its `describe` block; leave `buildContactActions` tests intact
- [x] 5.3 Confirm no remaining reference to group SMS: `grep -rniE "groupSms|GroupSms|buildGroupSmsRecipients|messageAll|group-sms" src test` returns nothing

## 6. Verify

- [x] 6.1 `npm run type-check` — no errors
- [x] 6.2 `npm run test` — all pass
- [x] 6.3 Manual: open a tour with 2+ partners; confirm no "Message all" button appears and the contact chip menu (call / WhatsApp) still works

## 7. Finalize

- [x] 7.1 Run `npx eslint . --fix` and review the diff size (guard against editor reformat drift)
- [x] 7.2 Prompt the user to commit (do NOT run `git commit`) with message: `fix(contacts): remove group messaging affordance (#200)`
- [x] 7.3 Prompt the user to push and open a PR against `main`
- [x] 7.4 After merge, prompt the user to archive this change with the `openspec-archive` skill
