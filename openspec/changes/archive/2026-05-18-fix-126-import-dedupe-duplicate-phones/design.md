## Context

The `contact_methods` table enforces `UNIQUE (contact_id, method_type, value)` via constraint `contact_methods_unique_per_contact`. Both import surfaces (Contact Picker API in `useContactPicker`, vCard parser in `parseVCardText`) can emit two `phones` entries with the same normalized E.164 `value` whenever a source contact stores the same number twice (common on Android when a number is saved with different OS-level labels but no label diff after `parseTelTypes`, or when iOS exports the same number under multiple `TEL` lines). The store passes `phones` straight to the repository which fans them out into one INSERT per row, and the second INSERT trips the unique constraint. The raw Postgres error then bubbles to the snackbar, leaking the constraint name to the end user.

## Goals / Non-Goals

**Goals:**

- Make import idempotent at the client: identical phone numbers on a source contact become a single row in `contact_methods`.
- Defense-in-depth: any future import path that bypasses parsers is still protected by a store-level dedupe.
- Friendly, localized error if the constraint ever fires anyway (manual entry, multi-tab race, etc.).
- Preserve current primary-selection behavior — dedupe must not silently demote a primary.
- Drop unparseable phones before they reach `contact_methods`; only valid E.164 numbers are saved.
- Per-contact validity rules: surface "no valid phone" when a contact had TEL entries but none parseable; import valid phones and notify on discarded count when mixed; fall back to email-only contact when source has no TEL but has an email.

**Non-Goals:**

- No schema or migration changes.
- No new dependencies.
- No UI redesign of import results; no snackbar for collapsed duplicates.
- No cross-contact dedupe — `contact_methods` per spec is scoped per contact.

## Decisions

### Dedupe location: parsers + store (belt-and-suspenders)

- Parsers (`useContactPicker`, `parseVCardText`) own the import data shape — natural place to enforce per-contact uniqueness before the rest of the pipeline ever sees duplicates.
- Store-level dedupe in `contacts-store.createContact` covers any future caller that hand-builds a `phones` array, and protects the import-results connect-prompt batching from inflated counts.
- Alternative considered — store only: simpler but loses information (which `label` to keep, how to OR-merge `isPrimary`) and import-results UI would still display duplicates before the store strips them. Rejected.

### Dedupe key and merge rules

- Phones dedupe key: the normalized `value` string. Both parsers emit `value` already (E.164 when parseable, trimmed raw otherwise — last bullet matters: two unparseable spellings of "ext. 1234" with identical trim collapse; different spellings stay separate, matching DB behavior).
- Merge rule for `isPrimary`: OR across collapsed entries (a `true` flag anywhere wins). Preserves the user's preference signal from any input copy.
- Merge rule for `label`: keep first non-null label in input order. Avoids losing a meaningful "Mobile" label just because an unlabeled copy appeared first.
- `rawPhoneNumbers` dedupe key: `value.trim().toLowerCase()`. Case-insensitive because the array is human-display only; trimming matches existing behavior.

### Store-level dedupe shape

- `createContact` deduplicates by `(methodType, value)` mirroring the DB unique key. Same merge rules as parsers.
- Done in the store, not the repository, so optimistic state and any pre-insert validation operate on the canonical list.

### DB-error mapping

- Repository wraps Supabase errors when inserting into `contact_methods`. Postgres `code === '23505'` on this table → throw a typed exception (`DuplicateContactMethodError` in `core/exceptions/`) carrying the i18n key `contacts.errors.duplicateMethod`.
- The contacts store's existing error handling renders `error.value` from typed exceptions through `useSnackbar` — point the snackbar at the i18n key.
- Alternative considered — only client dedupe, let raw errors bubble: cheaper but every future race or new import surface re-leaks the constraint name. Rejected.

### Silent UX for collapsed duplicates

- No snackbar / no toast on dedupe. Rationale: the user did not intend to import duplicates; surfacing a count is noise. The import-results sheet already shows the final per-contact phone list, which is the natural place to verify.

### Drop unparseable phones; surface per-contact validity

- The existing spec retains raw values inside `phones` for unparseable entries. This change reverses that decision: parsers SHALL keep `rawPhoneNumbers` (separate array, used only for UI hinting and the per-contact info snackbar) but SHALL emit only E.164-valid entries in `phones`. Rationale: any non-E.164 string is unsafe to write to `contact_methods.value` — it cannot be used for outgoing tel/SMS actions and cannot participate in cross-user phone matching.
- The contact-creation dialog's import loop decides, per source contact:
  - `phones.length > 0` → import normally.
  - `phones.length === 0` AND `rawPhoneNumbers.length > 0` → skip; emit per-contact error snackbar (`contacts.errors.noValidPhone` with name interpolation).
  - `phones.length === 0` AND `rawPhoneNumbers.length === 0` AND `emails.length > 0` → import contact with email-only methods.
  - `phones.length === 0` AND `rawPhoneNumbers.length === 0` AND `emails.length === 0` → import contact with name only (existing behavior).
  - `phones.length > 0` AND `rawPhoneNumbers.length > 0` → import valid phones; emit per-contact info snackbar (`contacts.errors.someInvalidPhonesDiscarded` with name + discarded count).
- Per-contact snackbars are emitted via `useSnackbar` after the per-contact create result resolves. The existing batch summary snackbar (X imported / Y skipped) continues to fire at the end.
- Alternative considered — single aggregated error/summary: less actionable, hides which contact had the issue. Rejected.

### Email import support

- vCard parser extracts `EMAIL` lines per block via regex matching the same way `TEL` is matched. Each value is trimmed and lowercased before dedupe; entries that don't match a basic `x@y.z` shape are dropped (no toast — emails are best-effort).
- Contact Picker requests `['name', 'tel', 'email']` from `navigator.contacts.select`. Each returned `email` string is trimmed + lowercased and deduped.
- Both parsers return a new `emails: string[]` array on their contact result type.
- `contacts-store.addContact` gains an optional `emails: string[]` argument. After phones are inserted, each email is inserted as `{ methodType: 'email', value, label: null, isPrimary: i === 0 }`. The "exactly-one-primary" invariant for emails follows the same rule as phones.
- Out of scope for this change: surfacing emails in the import-results UI, email edit/display on contact detail (already exists per contact-methods spec — verify only).

## Risks / Trade-offs

- [Risk] Dedupe at parse time hides genuinely distinct numbers that happen to normalize to the same E.164 (e.g. with vs. without extension stripped by `libphonenumber-js`). → Mitigation: dedupe key is the post-normalization `value`, which is the same key the DB uses — the dedupe is consistent with what the DB would reject anyway, so no information loss vs. status quo.
- [Risk] Primary-selection-after-dedupe could leave a contact with zero primary when all duplicate copies were `isPrimary: false`. → Mitigation: vCard parser's primary-selection step already runs over the deduped list and falls back to the first entry; Contact Picker's "first valid becomes primary" rule still holds after dedupe.
- [Risk] Store dedupe could mask a legitimate caller bug. → Mitigation: log at `debug` level via `useLogger` when the store collapses entries so issues surface in dev consoles.
- [Trade-off] DB-error mapping adds a typed exception and i18n keys for a path that should now be unreachable through normal flows. Worth it for graceful failure on races and manual entry paths.

## Migration Plan

- Pure client change, ships with the next release. No DB migration, no flag.
- Rollback: revert the PR; behavior returns to status quo (still buggy but no new surface area introduced).
