## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/50-contact-chip-click-actions`

## 2. Chip refactor

- [x] 2.1 Add `mode: 'select' | 'action'` prop (default `'select'`) to `contact-chip.vue`; remove `showActions` prop and the inline `<a>` action icons.
- [x] 2.2 Emit `toggle` only in select mode and `open` (with contact id) only in action mode; keep `selected` check glyph behavior unchanged for select mode.
- [x] 2.3 Verify tap target ≥44px on mobile after removing inline icons.
- [x] 2.4 Update unit tests for `contact-chip.vue` covering both modes and icon removal.

## 3. Contact actions model

- [x] 3.1 Add `buildContactActions(contact)` helper returning one entry per **valid** phone method (`isValid === true` AND non-null `whatsAppLink`), ordered primary-first via `orderedPhoneMethods`. Entry shape: `{ methodId, label, call: telLink, whatsApp: whatsAppLink }`. Invalid / legacy methods are omitted. No SMS field — SMS is group-only.
- [x] 3.2 Add `buildGroupSmsRecipients(partners)` helper returning `{ included: { contact, e164 }[], excluded: { contact, reason }[] }`. Inclusion requires primary phone with `isValid=true` and E.164 value.
- [x] 3.3 Unit tests for both helpers: single valid, multiple valid (ordering), invalid-only, no-phone, mixed valid+invalid.

## 4. Contact action menu

- [x] 4.1 Create `contact-action-menu.vue` under `features/contacts/presentation/components/` rendering a popover on desktop (anchored to a passed bounding rect / element ref) and a bottom sheet on mobile via `bottom-sheet.vue`.
- [x] 4.2 Render one labelled row per valid phone method (label + Call + WhatsApp) plus a final `Edit contact` row. When no valid methods exist, render only `Edit contact`. Never auto-select primary — each method is its own row so the user picks.
- [x] 4.3 Method actions: render as `<a href>` so `tel:` / `wa.me` fire immediately on tap with no confirmation; WhatsApp opens in a new tab. No SMS action in this menu.
- [x] 4.4 Edit-contact action: navigate to contacts route with `?edit=<id>` (add handler to `contacts-list-sheet.vue` to auto-open `contact-detail-view` for the id if not already present); close the tour info sheet first on mobile.
- [x] 4.5 Component tests: single valid method, multiple valid methods (both rows render, both pick cleanly), invalid-only contact (only Edit), no-phone contact (only Edit), mixed valid+invalid (only valid row), edit navigation on mobile vs desktop.

## 5. Tour info sheet integration

- [x] 5.1 In `tour-info-sheet.vue`, render partner `ContactChip`s in `mode="action"`; remove the `show-actions` prop usage.
- [x] 5.2 Wire chip `@open` handler: track the chip element, instantiate `ContactActionMenu` anchored to it with the selected partner.
- [x] 5.3 When `partners.length > 1`, render a "Message all" row with a single SMS icon button beneath the chips.
- [x] 5.4 Update `test/features/tours/presentation/components/tour-info-sheet.test.ts` to cover chip action mode, no inline icons, and presence/absence of the group row by partner count.

## 6. Group SMS dialog

- [x] 6.1 Create `group-sms-confirm-dialog.vue` (under `features/contacts/presentation/components/` or `features/tours/.../components/` — place where partner-level concerns live) accepting `partners: Contact[]` and emitting `confirm: (recipients: string[]) => void` + `cancel`.
- [x] 6.2 Compute Included (primary phone is E.164) and Excluded (no SMS-capable phone, with reason) lists; disable Send when Included is empty.
- [x] 6.3 On confirm, navigate to `sms:<E.164>,<E.164>,…` (comma-separated, no body) using `window.location.href` or an anchor click; close the dialog.
- [x] 6.4 Add tests: all-valid, some excluded, none valid (Send disabled), two-recipient URI composition.

## 7. Tour form selection mode untouched

- [x] 7.1 Confirm `tour-form.vue` uses chips without passing `mode` (default `'select'`) and still receives `toggle` events — no other changes.

## 8. Spec docs + cleanup

- [x] 8.1 Remove the now-dead inline-icon styles from `contact-chip.vue` and associated CSS.
- [x] 8.2 Sanity-check other callers of `<ContactChip>` (repo-wide grep) for `show-actions` usage and remove.
- [x] 8.3 Manual QA on desktop + iOS Safari + Chrome Android: single/multi partner, edit navigation, group SMS with excluded contact.

## 9. Finalize

- [x] 9.1 Run `npm run lint` and `npm run format`; fix any findings.
- [x] 9.2 Run `npm run type-check` and `npm run test`; all must pass.
- [x] 9.3 Prompt user to commit with conventional message: `feat: contact chip click actions and group SMS (#50)` — body referencing issue #50 and summarizing inline-icon removal + group SMS row.
- [x] 9.4 Prompt user to push branch and open PR against `main`.
