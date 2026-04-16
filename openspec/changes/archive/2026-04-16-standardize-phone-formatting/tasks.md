## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/standardize-phone-formatting`

## 2. Dependency

- [x] 2.1 Add `libphonenumber-js` to `dependencies` in `package.json` (run `npm install libphonenumber-js`)
- [x] 2.2 Verify the `min` metadata bundle resolves (`import { parsePhoneNumberFromString } from 'libphonenumber-js/min'`) and that `npm run build` succeeds without bundle-size warnings

## 3. Core Utilities

- [x] 3.1 Create `src/core/utils/phone-normalize.ts` exporting `normalizePhone(input, defaultCountry?: CountryCode)` returning `{ ok: true, value } | { ok: false, raw }` per `phone-formatting` spec
- [x] 3.2 Add `toE164(input, defaultCountry?: CountryCode): string | null` in the same module for the verification path
- [x] 3.3 Define and export `InvalidPhoneNumberError` in `src/core/exceptions/` for the store-level rejection path
- [x] 3.4 Hardcode `DEFAULT_REGION = 'CH'` and accept an override parameter on both functions
- [x] 3.5 Write Vitest unit tests in `test/core/utils/phone-normalize.test.ts` covering: Swiss national, plus-prefix, 00-prefix, foreign-with-country-code, override region, unparseable, empty, whitespace-only

## 4. AsYouType Composable

- [x] 4.1 Create `src/core/composables/use-as-you-type-phone.ts` exposing `useAsYouTypePhone(rawRef: Ref<string>, defaultCountry?: CountryCode)` returning `{ formatted: Ref<string>, onInput: (e: Event) => void }`
- [x] 4.2 Implement caret-preservation by computing the digit-offset before/after reformatting and restoring the caret position via `setSelectionRange`
- [x] 4.3 Write Vitest tests in `test/core/composables/use-as-you-type-phone.test.ts` covering: progressive typing of national number, progressive typing of `+`-prefixed number, mid-string insert preserves caret, paste of full canonical value formats correctly

## 5. Domain Display Helper

- [x] 5.1 Rewrite `formatPhoneDisplay(value)` in `src/features/contacts/domain/entities/contact.ts` to call `normalizePhone(value)` and return the canonical form on success or the trimmed original on failure
- [x] 5.2 Update tests in `test/features/contacts/domain/entities/contact.test.ts` (or create if missing) for legacy 00-prefix, legacy local, unrecognized fallback

## 6. Persistence-Boundary Normalization

- [x] 6.1 In `src/features/contacts/presentation/stores/contacts-store.ts`, normalize the phone argument inside `addContact` before invoking the contacts repository — empty/null pass through as `null`; failed normalization throws `InvalidPhoneNumberError`
- [x] 6.2 In `addMethodToContact`, when `methodType === 'phone'` normalize `value` the same way before calling the contact-methods repository
- [x] 6.3 In `updateMethodOnContact`, when the existing method is a phone (or `value` change concerns a phone method), normalize before calling the repository
- [x] 6.4 Surface `InvalidPhoneNumberError.message` via the existing store error refs so dialogs/forms can display it
- [x] 6.5 Write Vitest tests in `test/features/contacts/presentation/stores/contacts-store.test.ts` for: store rewrites unnormalized input on add/update, store rejects unparseable input, store accepts empty input as null

## 7. User-Profile Normalization

- [x] 7.1 In `src/features/user/presentation/stores/user-profile-store.ts`, normalize the phone via `normalizePhone` before writing `user_profiles.phone_number`
- [x] 7.2 In the same store, when calling `sendPhoneVerification`/`verifyPhone`, pass the value through `toE164` (return early with `InvalidPhoneNumberError` on `null`)
- [x] 7.3 Update `src/features/user/presentation/pages/onboarding-page.vue` and `src/features/user/presentation/components/user-profile-sheet.vue` to remove the local `e164Regex` validation and instead surface the normalizer's failure message via the existing `errors` refs
- [x] 7.4 Write Vitest tests asserting both the canonical write to `user_profiles.phone_number` and the E.164 payload sent to `signInWithOtp` come from the same input

## 8. Contact Form Live Formatting

- [x] 8.1 In `src/features/contacts/presentation/components/contact-form.vue`, replace the plain `v-model="phoneNumber"` input with one wired through `useAsYouTypePhone` so each keystroke renders the canonical-format-in-progress
- [x] 8.2 Keep `phoneNumber` as the underlying ref emitted on submit (raw string) — the store will normalize on persist; don't double-normalize in the form
- [x] 8.3 Update placeholder to `+41 79 012 34 56` to match the canonical example used in the spec

## 9. Contact Detail-View Live Formatting

- [x] 9.1 In `src/features/contacts/presentation/components/contact-detail-view.vue`, wrap each phone-method edit input through `useAsYouTypePhone` (skip for email methods)
- [x] 9.2 Wire the "Add method" form's value input through `useAsYouTypePhone` only when `newMethodType === 'phone'`; reset the formatter when the user toggles between phone and email
- [x] 9.3 Verify the existing display path (`methodDisplayValue` → `formatPhoneDisplay`) renders the new canonical form correctly

## 10. Import-Path Normalization

- [x] 10.1 In `src/features/contacts/presentation/composables/use-vcard-import.ts`, after extracting the `TEL` value, run it through `normalizePhone`; replace `phoneNumber` with `value` on success, retain trimmed raw on failure, leave `null` if no `TEL` field
- [x] 10.2 In `src/features/contacts/presentation/composables/use-contact-picker.ts`, run the picked `tel[0]` through `normalizePhone` with the same retain-on-failure semantics
- [x] 10.3 Update `test/features/contacts/presentation/composables/use-vcard-import.test.ts` (create if absent) for: parseable phone normalizes, unparseable phone retained, missing phone stays null
- [x] 10.4 Add similar tests for `use-contact-picker.ts` if mocks exist; otherwise document the manual test in the test plan

## 11. Import-Results UI

- [x] 11.1 In `src/features/contacts/presentation/components/contact-creation-dialog.vue`, augment the `ImportResult` rows with an `isPhoneCanonical` boolean (computed via `normalizePhone(...).ok` matched against the row's stored value) and render a small "couldn't parse" muted badge or info icon next to the phone when false
- [x] 11.2 Verify the snackbar copy still reads correctly when some rows have unparseable phones (no copy change required, but spot-check)

## 12. Integration Verification

- [x] 12.1 `npm run dev` and manually verify: typing `0791234567` in the contact form shows `+41 79 123 45 67` live; saving stores the canonical form (inspect via the contact detail view); WhatsApp icon now appears on the contact chip for that contact
- [x] 12.2 Manually verify import: drop a `.vcf` containing `TEL:0791234567` — import-results shows `+41 79 123 45 67` and the new contact has a working WhatsApp icon
- [x] 12.3 Manually verify import: drop a `.vcf` containing `TEL:not-a-number` — import-results shows the raw value with a "couldn't parse" indicator and the contact still imports
- [x] 12.4 Manually verify user-profile flow: enter `079 123 45 67` in onboarding/profile sheet — the OTP is requested for `+41791234567`; the stored profile phone reads `+41 79 123 45 67`

## 13. Finalize

- [x] 13.1 Run `npm run lint` and resolve every warning (CI enforces zero warnings)
- [x] 13.2 Run `npm run format` to apply Prettier
- [x] 13.3 Run `npm run type-check`
- [x] 13.4 Run `npm run test` and confirm all new + existing tests pass
- [x] 13.5 Prompt the user to commit with this ready-to-copy conventional-commit message:

      ```
      feat(phone): standardize phone numbers to canonical international format

      Normalize phone numbers at every write boundary (contact form, contact
      detail edit, vCard import, Contact Picker, user profile) using
      libphonenumber-js with default region CH. Add useAsYouTypePhone composable
      for live international formatting in inputs. Rewrite formatPhoneDisplay to
      normalize legacy data on read. Surface unparseable imports in the
      import-results view.
      ```

- [x] 13.6 Prompt the user to push the branch and open a PR against `main` (e.g. `gh pr create --fill --base main`)
