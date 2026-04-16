## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b fix/32-whatsapp-link-e164`

## 2. Update `usePhoneActions` composable

- [x] 2.1 In `src/features/contacts/presentation/composables/use-phone-actions.ts`, change `whatsAppLink` computed to return `null` when the trimmed input does not start with `+` or `00`
- [x] 2.2 When input starts with `+`, strip `+` and all non-digit characters, return `https://wa.me/<digits>`
- [x] 2.3 When input starts with `00`, strip the leading `00` and all remaining non-digit characters, return `https://wa.me/<digits>`
- [x] 2.4 Leave `telLink` logic and `stripToDialable` helper untouched
- [x] 2.5 Keep JSDoc accurate — note that `whatsAppLink` is `null` unless input is in international form

## 3. Update unit tests

- [x] 3.1 In `test/features/contacts/presentation/composables/use-phone-actions.test.ts`, update the existing "Generate WhatsApp link with digits only" test to assert `+41 79 123 45 67` → `https://wa.me/41791234567`
- [x] 3.2 Add test: `0041 79 123 45 67` → `whatsAppLink` is `https://wa.me/41791234567`
- [x] 3.3 Add test: `079 123 45 67` → `whatsAppLink` is `null`, `telLink` is `tel:0791234567`
- [x] 3.4 Add test: input with leading/trailing whitespace before `+` is still treated as international (e.g., ` +41 79 ...`)
- [x] 3.5 Verify the existing `null` input and "phone with spaces / plus" tests still pass
- [x] 3.6 Run `npx vitest run test/features/contacts/presentation/composables/use-phone-actions.test.ts` and confirm green

## 4. Manual verification

- [ ] 4.1 `npm run dev`, open a tour with a linked contact whose phone is in `+41 ...` format, tap WhatsApp icon — chat opens without error
- [ ] 4.2 Open a tour with a linked contact whose phone is in `079 ...` local format — WhatsApp icon is hidden, call icon still visible and functional
- [ ] 4.3 Confirm contact form placeholder `+41 79 123 45 67` still displays in `contact-detail-view.vue` (no copy change required)

## 5. Finalize

- [x] 5.1 Run `npm run lint` — zero warnings
- [x] 5.2 Run `npm run format`
- [x] 5.3 Run `npm run type-check`
- [x] 5.4 Run full `npm run test` — all green
- [ ] 5.5 Prompt user to commit with ready-to-copy message:

  ```
  fix(contacts): only emit wa.me link for international phone numbers (#32)
  ```

- [ ] 5.6 Prompt user to push branch and open PR against `main` referencing issue #32
- [ ] 5.7 After merge, prompt user to archive change with `/opsx:archive fix-whatsapp-link-e164`
