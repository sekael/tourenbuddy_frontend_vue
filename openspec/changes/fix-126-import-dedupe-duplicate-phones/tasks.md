## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b fix/126-graceful-duplicate-phone-import`

## 2. Shared dedupe helpers

- [x] 2.1 Add a pure helper `dedupePhones(phones, { keyOf })` in `src/features/contacts/core/utils/` implementing: OR-merge `isPrimary`, first non-null `label`, preserve first-occurrence order.
- [x] 2.2 Add sibling `dedupeRawPhones(values)` (trim+lowercase key, preserve first-seen casing).
- [x] 2.3 Add sibling `dedupeEmails(values)` (trim+lowercase key, drop values not matching `<local>@<domain>.<tld>` regex, return lowercased values in first-seen order).

## 3. Contact Picker — dedupe, drop invalid, extract emails

- [x] 3.1 In `src/features/contacts/presentation/composables/use-contact-picker.ts`, request `['name', 'tel', 'email']` from `navigator.contacts.select`.
- [x] 3.2 Build `phones` from `tel` values where `normalizePhone(...).ok === true`; unparseable values go to `rawPhoneNumbers`. Mark `isPrimary: true` on the first parseable phone.
- [x] 3.3 Apply `dedupePhones` to `phones` and `dedupeRawPhones` to `rawPhoneNumbers`.
- [x] 3.4 Parse `email` array via `dedupeEmails`, expose on returned `PickedContact` as `emails: string[]`.
- [x] 3.5 Update `PickedContact` type to include `emails: string[]`.

## 4. vCard parser — dedupe, drop invalid, extract emails

- [x] 4.1 In `parseVCardText`, when `normalizePhone` fails, route the value into `rawPhoneNumbers` only — do not include it in `phones`. (Removes the current "raw value retained in phones" branch.)
- [x] 4.2 Apply `dedupePhones` to `parsedPhones` BEFORE primary-resolution so PREF/CELL/HOME/WORK runs on a unique set.
- [x] 4.3 Apply `dedupeRawPhones` to `rawPhoneNumbers`.
- [x] 4.4 Match `EMAIL` lines via regex (analogous to `TEL` matcher), feed values through `dedupeEmails`, expose as `emails: string[]` on `VCardContact`.
- [x] 4.5 Update `VCardContact` type to include `emails: string[]`.

## 5. Store — dedupe phones, accept emails, debug log

- [x] 5.1 Extend `contacts-store.addContact` signature with optional `emails?: string[]` argument (after existing args; keep call sites compiling).
- [x] 5.2 Dedupe `phones` by `(methodType, value)` before insert; if collapsed, log via `useLogger` at `debug` level with the collapsed count.
- [x] 5.3 After phone inserts, run `dedupeEmails(emails)` (defense-in-depth) and insert each as `{ methodType: 'email', value, label: null, isPrimary: i === 0 }`.
- [x] 5.4 Confirm the existing "exactly one primary phone" invariant still passes after dedupe.

## 6. Contact-creation dialog — per-contact validity branching

- [x] 6.1 In `src/features/contacts/presentation/components/contact-creation-dialog.vue` import loop, branch per parsed contact per `(phones.length, rawPhoneNumbers.length, emails.length)`:
  - phones=0, raw>0 → skip; emit snackbar `contacts.errors.noValidPhone` interpolating name; increment skipped count.
  - phones>0, raw>0 → import valid phones; emit snackbar `contacts.errors.someInvalidPhonesDiscarded` interpolating name + raw.length.
  - phones=0, raw=0, emails>0 → call `addContact` with `phones: []` and `emails`; no snackbar.
  - phones=0, raw=0, emails=0 → existing name-only path.
  - phones>0, raw=0 → existing path.
- [x] 6.2 Update end-of-batch summary snackbar to count rule-1 skips in the skipped tally.

## 7. Repository error mapping

- [x] 7.1 Add `DuplicateContactMethodError` to `src/core/exceptions/` extending the existing exception base, carrying `i18nKey: 'contacts.errors.duplicateMethod'`.
- [x] 7.2 In `src/features/contacts/data/repositories/contact-methods-repository-impl.ts`, when a Supabase insert returns `error.code === '23505'` AND the message references `contact_methods_unique_per_contact`, throw `DuplicateContactMethodError`. Other errors pass through.
- [x] 7.3 Audit `src/features/contacts/data/repositories/contacts-repository-impl.ts` for direct `contact_methods` inserts during contact creation and apply the same mapping.
- [x] 7.4 Ensure the snackbar path resolves the typed exception's i18n key (no raw Postgres message reaches the user).

## 8. i18n keys

- [x] 8.1 Add to `src/locales/en.json`:
  - `contacts.errors.duplicateMethod` — e.g. "This phone number is already saved for this contact."
  - `contacts.errors.noValidPhone` — e.g. "No valid phone number for {name} — contact skipped."
  - `contacts.errors.someInvalidPhonesDiscarded` — e.g. "Discarded {count} invalid phone number(s) for {name}."
- [x] 8.2 Add the same three keys to `src/locales/de-CH.json` with localized text.

## 9. Tests

- [x] 9.1 Extend `test/features/contacts/presentation/composables/use-vcard-import.spec.ts`:
  - two identical TEL lines collapse to one entry
  - two TEL lines normalizing to the same E.164 collapse with first non-null label preserved
  - PREF on a duplicate copy is preserved post-dedupe
  - duplicate `rawPhoneNumbers` collapse case-insensitively
  - unparseable TEL no longer in `phones`, present in `rawPhoneNumbers`
  - `EMAIL` lines extracted, deduped lowercase, malformed values dropped
  - distinct phones not collapsed
- [x] 9.2 Add `test/features/contacts/presentation/composables/use-contact-picker.spec.ts`:
  - duplicate tel values collapse with `isPrimary: true` retained
  - unparseable tel goes to `rawPhoneNumbers`, not `phones`
  - emails returned + deduped lowercase
  - cancel returns `[]` (regression)
- [x] 9.3 Extend `test/features/contacts/presentation/stores/contacts-store.spec.ts`:
  - `addContact` with duplicate phones → repository receives deduped list; debug log emitted
  - `addContact` with emails-only argument → only `email` methods inserted, first marked primary
  - `addContact` with phones + emails → both inserted; primary of each type set
  - cross-`methodType` identical `value` strings NOT collapsed
- [x] 9.4 Add a repository unit test asserting `23505` on `contact_methods_unique_per_contact` maps to `DuplicateContactMethodError`; non-23505 errors pass through unchanged.
- [x] 9.5 Add a component-level test for `contact-creation-dialog.vue` covering the three new branches (`noValidPhone`, `someInvalidPhonesDiscarded`, email-only fallback) — use `createTestingPinia` and mock parsers.
- [x] 9.6 `npm run test` — all green.

## 10. Manual verification

- [ ] 10.1 Repro on Android: create a device contact with two identical phone numbers, run "Import from contacts" → exactly one phone saved, no error snackbar.
- [ ] 10.2 vCard import with duplicate `TEL` lines → one phone saved.
- [ ] 10.3 Android contact with only unparseable phone (e.g. "ext. 1234") → contact skipped, `noValidPhone` snackbar shown.
- [ ] 10.4 Contact with one valid + two unparseable phones → contact imported with the valid phone, `someInvalidPhonesDiscarded` snackbar shown.
- [ ] 10.5 vCard contact with only an `EMAIL` and no `TEL` → contact imported with email method.
- [ ] 10.6 Sanity-check happy paths: single phone, multi distinct phones, no phones + no email.

## 11. Finalize

- [x] 11.1 `npx eslint . --fix` and `npm run type-check` — zero warnings, zero errors.
- [ ] 11.2 Prompt the user to commit with a ready-to-copy conventional commit message, e.g.:
  - `fix(contacts): graceful import — dedupe, drop invalid phones, email fallback (#126)`
  - body summarizing parser + store dedupe, drop-unparseable rule, per-contact branching, email fallback, and 23505 error mapping.
- [ ] 11.3 Prompt the user to push the branch and open a PR against `main` linking issue #126.
- [ ] 11.4 Prompt the user to archive this change via the `openspec-archive` skill once merged.
