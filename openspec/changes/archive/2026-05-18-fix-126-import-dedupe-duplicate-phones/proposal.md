## Why

Importing a device contact (Android Contact Picker) or vCard entry that has two or more identical phone numbers crashes the import with a raw Postgres error: `duplicate key value violates unique constraint "contact_methods_unique_per_contact"`. The DB constraint `UNIQUE (contact_id, method_type, value)` is correct; the client never collapses duplicates before INSERT and never translates the constraint name into something a user can act on. The same import flows also currently retain unparseable phone values and surface them as best-effort rows, which lets bad data reach `contact_methods` and confuses the user. Issue #126.

## What Changes

Dedupe:

- Contact Picker composable collapses duplicate phone entries (by normalized E.164 `value`) before returning them; merges `isPrimary` via OR; keeps the first non-null `label`.
- Contact Picker composable also deduplicates `rawPhoneNumbers` (unparseable phones) case-insensitively after trimming.
- vCard parser applies the same dedupe rule to its normalized phones array (before primary resolution) and to `rawPhoneNumbers`.
- `contacts-store.addContact` deduplicates the phones array by `(methodType, value)` before calling the repository — final safety net for any future import source.

Discard invalid + per-contact validity rules:

- Parsers SHALL emit only phones whose `value` is a valid E.164 (i.e. `normalizePhone` returned `ok: true`). Unparseable raw values SHALL be reported separately as `rawPhoneNumbers` (already today) but SHALL NOT flow into the `phones` array nor be saved as `contact_methods` rows.
- When a source contact has ≥1 `TEL` entry but ZERO parseable phones, the import SHALL skip that contact and surface a per-contact error (i18n `contacts.errors.noValidPhone`) naming the contact.
- When a source contact has BOTH valid and invalid phones, the valid ones SHALL be imported (with label + primary-selection per existing priority rules); the discarded count SHALL be surfaced as a per-contact info snackbar (i18n `contacts.errors.someInvalidPhonesDiscarded`).
- When a source contact has NO `TEL` entries at all but DOES expose an email address, the contact SHALL be imported with that email as an `email` contact method (no phone). When a contact has no `TEL` and no email, the contact is imported with name only (existing behavior).

Email support in importers:

- Contact Picker composable SHALL also request the `email` property and return parsed emails (deduped, lowercase-trimmed comparison).
- vCard parser SHALL extract `EMAIL` lines (deduped, lowercase-trimmed comparison).
- `contacts-store.addContact` SHALL accept an optional `emails` argument and insert them as `email` contact methods after the phones.

Error mapping + i18n:

- Repository layer maps Postgres `23505` unique_violation on `contact_methods` inserts to a friendly, i18n-keyed message instead of surfacing the raw constraint name.
- New i18n keys (`contacts.errors.duplicateMethod`, `contacts.errors.noValidPhone`, `contacts.errors.someInvalidPhonesDiscarded`) in `en.json` and `de-CH.json`.
- Silent UX when duplicates are collapsed during parsing; explicit per-contact snackbars only for the discarded/no-valid cases above.

Out of scope: schema/migration changes (UNIQUE constraint stays as-is); no new dependencies; no UI redesign of import results beyond the new snackbar copy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contact-device-import`: parsers must dedupe identical phones (and raw unparseable values) per contact; parsers must emit only parseable phones in `phones`; parsers must extract emails; the dialog must skip contacts with no valid phone (when source had TEL entries), surface a per-contact error, and surface a per-contact info when valid + invalid coexist.
- `contact-methods`: repository inserts must translate Postgres unique-violation (`23505`) on `contact_methods_unique_per_contact` into a user-facing i18n message; store `addContact` must dedupe phones in before insert and accept an optional `emails` argument.

## Impact

- Code:
  - `src/features/contacts/presentation/composables/use-contact-picker.ts`
  - `src/features/contacts/presentation/composables/use-vcard-import.ts`
  - `src/features/contacts/presentation/stores/contacts-store.ts`
  - `src/features/contacts/data/repositories/contact-methods-repository-impl.ts`
  - `src/features/contacts/data/repositories/contacts-repository-impl.ts` (only if it performs method inserts during contact creation)
  - `src/features/contacts/presentation/components/contact-creation-dialog.vue` (per-contact skip + snackbars during import loop)
  - `src/locales/en.json`, `src/locales/de-CH.json`
- Tests:
  - `test/features/contacts/presentation/composables/use-vcard-import.spec.ts`
  - new `test/features/contacts/presentation/composables/use-contact-picker.spec.ts`
  - `test/features/contacts/presentation/stores/contacts-store.spec.ts`
  - repository test for 23505 mapping
- APIs / dependencies / DB: no changes.
