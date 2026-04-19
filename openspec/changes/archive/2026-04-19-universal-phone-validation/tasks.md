## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/universal-phone-validation`

## 2. Canonical phone utility

- [x] 2.1 Update `src/core/utils/phone-normalize.ts`: change `normalizePhone` return shape to `{ ok: true, e164 }` (rename `value` → `e164`, format with `parsed.format('E.164')`).
- [x] 2.2 Add `formatPhoneForDisplay(e164)` helper using `formatInternational()`, pass-through on parse failure.
- [x] 2.3 Remove standalone `toE164` (callers use `normalizePhone(...).e164`).
- [x] 2.4 Update `test/core/utils/phone-normalize.test.ts` (or create) to cover all `phone-formatting` spec scenarios.

## 3. Schema + repository guards

- [x] 3.1 Add `is_valid` boolean column to `contact_methods` table (Supabase migration SQL, default `true`).
- [x] 3.2 Update `contactMethodRowSchema` / `contactMethodSchema` to include `isValid` and refine `value` as E.164 when `methodType==='phone' && isValid===true`.
- [x] 3.3 In `ContactMethodsRepository` Supabase impl: in `addMethod` and `updateMethod`, when `methodType==='phone'`, call `normalizePhone(value)`; throw `ValidationError` if `!ok`; persist `e164` form.
- [x] 3.4 Update repo tests to cover valid + invalid phone insert/update paths.

## 4. Manual form enforcement

- [x] 4.1 Contact creation dialog (`form` view): keep `useAsYouTypePhone` live formatting on the phone input; on submit, run `normalizePhone(rawInput)` if non-empty; show inline error and block submit when `!ok`; pass `e164` to `contactsStore.addContact`.
- [x] 4.2 Contact detail view phone-method edit row: apply `useAsYouTypePhone` to the input; same validation on save; show inline error; persist `e164`.
- [x] 4.3 Add-method form (new phone method on existing contact): apply `useAsYouTypePhone`; same validate-on-save flow.
- [x] 4.4 Surface `isValid===false` rows on detail view with warning indicator + raw value (per `contacts` spec).
- [x] 4.5 Update component tests for all manual entry forms (live format applied + validation gate).

## 5. Import path enforcement

- [x] 5.1 `useVCardImport`: when `normalizePhone` fails on a non-empty `TEL`, set `phoneNumber=null` and `rawPhoneNumber=trimmedRaw`. Add `rawPhoneNumber` to the parsed contact type.
- [x] 5.2 `useContactPicker`: same change — `phoneNumber=null` + `rawPhoneNumber` retained on failure.
- [x] 5.3 Import-results UI: render `rawPhoneNumber` with existing "couldn't parse" indicator when `phoneNumber` is null and raw is set.
- [x] 5.4 Downstream contact creation in import flow: skip phone-method creation when `phoneNumber` is null (contact still created).
- [x] 5.5 Update tests for `useVCardImport`, `useContactPicker`, and the import-results component.

## 6. Phone action links

- [x] 6.1 Update `usePhoneActions`: assume E.164; always produce both `tel` + `wa.me` links when input non-null. Keep legacy fallback path for non-E.164 inputs (telLink only, whatsAppLink null).
- [x] 6.2 Update `usePhoneActions` tests for E.164 + legacy fallback scenarios.
- [x] 6.3 Update contact chip rendering to use `formatPhoneForDisplay`.

## 7. Migration script

- [x] 7.1 Write `scripts/migrate-phones-to-e164.ts`: read all `contact_methods` rows where `method_type='phone'`; for each, run `normalizePhone`; if `ok`, UPDATE `value=e164`; else UPDATE `is_valid=false`. Log counts (updated / flagged / unchanged).
- [x] 7.2 Add npm script entry `migrate:phones-e164`.
- [x] 7.3 Run against staging; verify counts; then run against production.

## 8. Verify across paths

- [x] 8.1 Manual QA: add via form (valid + invalid), edit via detail (valid + invalid + repair flagged), import vCard (mix of valid/invalid/missing), import via Contact Picker (Android Chrome).
- [x] 8.2 Confirm contact chip phone actions work (call + WhatsApp) for newly added contacts.

## 9. Finalize

- [x] 9.1 Run `npm run lint` and `npm run format`; fix any issues.
- [x] 9.2 Run `npm run type-check` and `npm run test`; ensure all green.
- [x] 9.3 Prompt user to commit with conventional commit message (e.g. `feat(contacts): enforce universal phone validation and E.164 normalization`).
- [x] 9.4 Prompt user to push branch and open PR against `main`.
