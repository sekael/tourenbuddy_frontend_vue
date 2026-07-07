## Why

The tour info sheet's "Message all" affordance (GitHub issue #200) only ever opens a 1:1 conversation with the first recipient. The root cause is not a bug we can fix: multi-recipient `sms:` URIs are unreliable across OS/handlers (Android `;` vs iOS `,`, and many handlers silently drop everything after the first number), and no messaging app reachable from a PWA (SMS, WhatsApp, Telegram, Signal) exposes a reliable multi-recipient compose deep-link. There is no path to a good UX, so we remove the feature rather than ship a broken one.

## What Changes

- **BREAKING** Remove the group messaging affordance from the tour info sheet: no more "Message all" button, confirmation dialog, or group SMS launch.
- Delete the `group-sms-confirm-dialog.vue` component and its test.
- Remove `buildGroupSmsRecipients` and the `GroupSmsResult` type from `contact-actions.ts`; keep `buildContactActions` (single-recipient call / WhatsApp) untouched.
- Remove the group-messaging UI wiring from `tour-info-sheet.vue` (`showGroupSmsDialog` state, the button, the dialog mount, `.group-sms-btn` CSS).
- Remove now-dead i18n: the `contacts.groupSms` block and `tours.infoSheet.messageAll` key from `en.json` and `de-CH.json`.
- Single-recipient messaging via the contact chip → `ContactActionMenu` (call / WhatsApp) is unchanged and remains the only messaging path.

## Capabilities

### New Capabilities
<!-- None: this change only removes an existing capability. -->

### Modified Capabilities
- `tour-group-messaging`: All requirements are REMOVED. The capability is retired — group SMS row, confirmation dialog, and launch target no longer exist.

## Impact

- **Code:** `src/features/contacts/presentation/components/group-sms-confirm-dialog.vue` (deleted), `src/features/contacts/core/utils/contact-actions.ts`, `src/features/tours/presentation/components/tour-info-sheet.vue`.
- **i18n:** `src/locales/en.json`, `src/locales/de-CH.json`.
- **Tests:** `test/features/contacts/presentation/components/group-sms-confirm-dialog.test.ts` (deleted), `test/features/contacts/core/utils/contact-actions.test.ts` (group SMS cases removed).
- **User-facing:** Users can no longer trigger a group message from a tour; they message partners one at a time via the existing contact chip menu. No data model, DB, or API impact.
- **Spec:** `openspec/specs/tour-group-messaging/` retired on archive.
