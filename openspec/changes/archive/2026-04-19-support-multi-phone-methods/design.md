## Context

Contacts use a 1:N `contacts → contact_methods` schema (Supabase). `contact_methods.is_primary boolean` exists but today is treated as a hint: imports only ever create one phone row, and `getPrimaryPhone` falls back to the first phone when nothing is flagged. vCard `TEL` lines carry `TYPE` (e.g. `TYPE=CELL`, `TYPE=HOME,VOICE`) and users routinely have ≥2 numbers. Contact Picker API's `ContactInfo.tel` is already `string[]`. Consumers of primary phone: `ContactChip` (tour info phone actions), `ContactListItem` subtitle, contact detail view, import-results row.

## Goals / Non-Goals

**Goals:**

- Preserve every phone from imports and manual entry.
- Exactly one phone per contact carries `isPrimary = true` whenever ≥1 phone exists.
- Deterministic ordering: primary first everywhere phones render.
- Zero schema migration; invariant enforced in app code.

**Non-Goals:**

- Email primary-method support (issue scoped to phone).
- DB-level uniqueness constraint (follow-up partial index, not required here).
- Backfill of legacy rows — `getPrimaryPhone` fallback handles them until they're re-edited.
- Deduplicating phones across imported contacts.

## Decisions

### Enforce single-primary invariant in the Pinia store, not the DB

`contactsStore.addMethodToContact` and `updateMethodOnContact` own primary flipping: setting `isPrimary: true` on a phone method issues a second repo call to clear `is_primary` on sibling phone methods before (or after, inside a best-effort sequence — Supabase does not offer multi-row transactions over PostgREST). Adding the first phone method auto-sets `isPrimary = true`. Removing the current primary auto-promotes the next phone in insertion order.

**Alternative considered**: DB trigger + partial unique index. Rejected for scope — requires migration tooling not used on this branch, and app-level enforcement keeps validation close to the form UI that already governs the invariant.

### `setPrimaryPhone(contactId, methodId)` helper — transactional via RPC

DB is the source of truth for `is_primary`. The repo helper calls a Supabase RPC (Postgres function `set_primary_phone(p_contact_id uuid, p_method_id uuid)`) that runs both UPDATEs inside a single transaction, returning the updated rows. The RPC SHALL:

1. Snapshot the current primary phone id for the contact (for diagnostics).
2. `UPDATE contact_methods SET is_primary = false WHERE contact_id = p_contact_id AND method_type = 'phone' AND id <> p_method_id`.
3. `UPDATE contact_methods SET is_primary = true WHERE id = p_method_id AND contact_id = p_contact_id AND method_type = 'phone'`.
4. RAISE EXCEPTION if step 3 affects zero rows (bad id / wrong contact / wrong type) — the transaction rolls back, leaving the previous primary intact.

On the client, if the RPC call rejects, the store SHALL NOT mutate local `is_primary` state — the previous primary stays the primary. The store refetches the contact from the repo when the error is ambiguous (network timeout) to re-sync with DB truth.

**Alternative considered**: two sequential PostgREST UPDATEs from the client. Rejected — partial failure between the clear and the set leaves the contact with zero primary, and the user's "fall back to previous primary on failure" requirement cannot be met without server-side atomicity.

### DB is source of truth for primary

The store SHALL NOT speculatively flip `isPrimary` locally before the RPC resolves. The optimistic UI shows a pending state on the tapped radio; the store commits the local mutation only after the RPC returns the updated rows (or a successful fetch). This guarantees the rendered primary always reflects `contact_methods.is_primary` in the DB.

### `addContact` store signature change

Replace `phoneNumber?: string | null` with `phones?: Array<{ value: string, label?: string | null, isPrimary: boolean }>`. Exactly one entry with `isPrimary: true` required when `phones.length > 0` (validated in store, throws `InvalidPhoneNumberError` analogue for missing-primary). Callers (import-results commit, manual form submit) assemble the array.

**Alternative considered**: keep `phoneNumber` + add `secondaryPhoneNumbers`. Rejected — asymmetric API, worse for future email parity.

### vCard parser returns `phones: VCardPhone[]`

Shape: `{ value: string, label: string | null, isPrimary: boolean }`. Rules:

- Iterate every `TEL` line in the block (regex switches from `.match` to `.matchAll`).
- Label derived from `TYPE=` parameter: join types with `/`, map common (`CELL` → "Mobile", `HOME` → "Home", `WORK` → "Work"), fall back to raw value. Empty / missing → `null`.
- Primary selection precedence:
  1. vCard `PREF` marker (v3 `TYPE=PREF` or v4 `PREF=` parameter — lowest `PREF` numeric value wins when multiple).
  2. When no `PREF`: first entry whose `TYPE` includes `CELL`.
  3. Else first entry whose `TYPE` includes `HOME`.
  4. Else first entry whose `TYPE` includes `WORK`.
  5. Else first `TEL` entry in document order.
- Per-entry normalization as today; unparseable entries keep raw value and still count as phones.
- Back-compat: existing `phoneNumber` field kept on return type for snackbars/tests? No — rip it, callers migrate.

### Contact Picker returns all `tel[]` entries

Map each entry through `normalizePhone`. Primary = index 0 (platform does not expose preference). No label (API gives none).

### Manual form UX

`ContactForm` renders a dynamic list of phone rows (value + optional label + "primary" radio). "Add phone" button appends a row. Remove button per row. Validation: if `rows.length > 1`, exactly one must be primary-selected. If `rows.length === 1`, that row is implicitly primary. First phone row is pre-selected primary.

Contact detail view gains the same dynamic list with a "primary" radio group bound to existing phone methods — toggling issues `setPrimaryPhone`.

### Primary highlight — star icon

UI highlights the primary phone with a filled Material Symbols `star` icon adjacent to the phone value (chip, list subtitle, detail row, import-results row). Non-primary phones render without the icon. The primary-selection control in forms/detail view is a radio that uses the same `star` glyph (outlined when unselected, filled when selected) so the affordance matches the read-only highlight.

### Rendering order

`Contact.contactMethods` stays as stored; consumers that need ordered phones use a computed `orderedPhoneMethods`: primary first, then remaining by insertion order (stable via `id` or `createdAt` if available). Implement as a pure helper in `contacts/core/utils/order-phone-methods.ts` so chip, list item, detail view share it.

## Risks / Trade-offs

- [RPC unavailable in dev DB / migrations not run] → Ship SQL migration with the PR creating `set_primary_phone` function; document apply step.
- [Concurrent `set_primary_phone` calls] → DB serializes updates per-row; worst case last writer wins. Acceptable — single-user app.
- [Legacy rows with no primary] → `getPrimaryPhone` fallback to first phone preserves current behavior until user re-edits.
- [vCard `PREF` parsing edge cases (mixed v3 `TYPE=PREF` and v4 `PREF=1`)] → Accept both; if neither present, fall back to first `TEL`.
- [Import-results row becomes multi-line when a contact has many phones] → Show primary inline, collapse additional phones behind "+N more" chip.

## Migration Plan

DB migration: add Postgres function `set_primary_phone(p_contact_id uuid, p_method_id uuid) RETURNS SETOF contact_methods` as `SECURITY INVOKER` (RLS applies). No schema column changes.

Code rollout:

1. Ship repo + store changes behind no flag — invariant is additive for single-phone contacts.
2. Update imports + forms in the same PR to avoid intermediate states.
3. `getPrimaryPhone` keeps legacy fallback indefinitely; safe no-op for existing data.

Rollback: revert the PR — data written in the new format (multiple phone rows with one primary) remains valid under old readers because the old code ignored non-first phone rows; `getPrimaryPhone` fallback still returns a phone.

## Open Questions

- Should import-results row let the user pick the primary before commit, or accept parser's choice and let them fix it in detail view? → Default: accept parser choice (simpler), edit in detail view.
