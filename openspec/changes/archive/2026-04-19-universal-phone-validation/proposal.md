## Why

Phone validation today is inconsistent across entry paths. Manual add/edit, vCard import, and Contact Picker each handle parsing differently — some accept invalid numbers as raw fallbacks, formats stored vary (spaced international vs. national vs. raw). Result: contacts may have unusable numbers that break call/WhatsApp links and downstream verification flows. Need one validation rule applied universally.

## What Changes

- **BREAKING**: Reject invalid phone numbers at every contact entry point (manual add, manual edit, vCard import, Contact Picker). No raw-fallback persistence.
- Centralize validation in shared utility: parse via `libphonenumber-js`, require `isValid()` for the country code, normalize to E.164 (`+CCNNNNNNNN`).
- Single canonical storage form for all `contact_methods.value` rows of type `phone`: E.164.
- Manual forms: inline validation error blocks save when phone field is non-empty and invalid; empty phone still permitted (contacts without phone allowed).
- vCard import: drop or flag entries with invalid `TEL`; existing "couldn't parse" indicator extended to all import paths.
- Contact Picker import: same — invalid phones rejected, surfaced in import results.
- Contact verification (user's own phone) unchanged — still requires OTP. Contact-method phones are validated only, not verified.
- Migration: one-off normalization of existing `contact_methods` rows to E.164; rows that fail validation flagged for user review (not auto-deleted).

## Capabilities

### New Capabilities

- `phone-formatting`: Canonical phone parse/validate/normalize utility used by every entry path. Defines E.164 as storage form, rules for empty vs. invalid, default region behavior.

### Modified Capabilities

- `contact-methods`: Phone method `value` SHALL be E.164; repository rejects non-E.164 phone inserts/updates.
- `contacts`: `addContact` and update flows enforce phone validation before persistence.
- `contact-device-import`: vCard + Contact Picker paths reject invalid phones instead of retaining raw values; both surface invalid entries in import results.
- `contact-phone`: Phone action links assume E.164 input; simplifies WhatsApp link logic (always available when phone present).

## Impact

- Code: `src/core/utils/phone-normalize.ts` (canonical API), `src/features/contacts/data/repositories/*` (validation guard), `src/features/contacts/presentation/components/*` (form validation), `useVCardImport`, `useContactPicker`, `usePhoneActions`.
- Data: Supabase migration to normalize existing `contact_methods.value` rows to E.164; flag-table or `is_valid` column for unparseable legacy rows.
- Tests: update existing phone-related unit/component tests; add validation coverage per entry path.
- No new dependencies — `libphonenumber-js` already present.
