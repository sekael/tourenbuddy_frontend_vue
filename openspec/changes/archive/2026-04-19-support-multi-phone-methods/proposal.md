## Why

Contacts often have multiple phone numbers (mobile, home, work). Today the app stores only one phone per contact during import (first `TEL` entry wins) and manual entry captures one number — users lose data and cannot reach a contact on their preferred line. Enforcing a single primary phone gives downstream UI (contact chip call/WhatsApp actions, list subtitle) a deterministic number to show while preserving all imported numbers. Resolves GitHub issue #41.

## What Changes

- vCard import SHALL extract every `TEL` entry per vCard block (not just the first) and preserve its `TYPE` parameter as the method label when present.
- Contact Picker import SHALL return every phone the user exposes per contact (not just one).
- Contact creation (import results + manual) SHALL create one `contact_methods` row per phone; exactly one phone SHALL be marked `isPrimary = true`.
- Manual contact form SHALL allow adding/removing multiple phone rows and SHALL require picking a primary when >1 phone is entered.
- Contact detail view SHALL enforce the single-primary invariant when adding, removing, or toggling phone methods (flipping one to primary unsets others).
- `getPrimaryPhone` SHALL return the explicitly primary phone; fallback to first phone only when no phone is marked primary (legacy rows).
- vCard primary selection precedence when no `PREF` marker: first CELL → first HOME → first WORK → first TEL in document order.
- UI SHALL render phone methods with the primary phone first and highlight the primary with a filled Material Symbols `star` icon in contact list subtitles, contact chips, contact detail view, and import-results rows.
- `ContactMethodsRepository` SHALL gain a helper (`setPrimaryPhone(contactId, methodId)`) backed by a Supabase RPC that runs clear-and-set inside a single DB transaction; on failure the previous primary is preserved.
- DB column `contact_methods.is_primary` is the source of truth; the client SHALL NOT speculatively mutate primary state before the RPC succeeds.
- `addContact` store action signature expands to accept multiple phones with a primary index instead of a single `phoneNumber` string. **BREAKING** for internal callers.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `contact-methods`: add single-primary-phone invariant + `setPrimaryPhone` repo method; update `getPrimaryPhone` to prefer explicit primary.
- `contact-device-import`: vCard + Contact Picker parsers return array of phones per contact with optional label; normalization applied per entry.
- `contacts`: contact creation dialog and contact detail view support multiple phone rows with primary selection; `addContact` store action accepts multiple phones; list/detail UI renders primary first.

## Impact

- **Code**: `use-vcard-import.ts`, `use-contact-picker.ts`, `contacts-store.ts`, `contact-methods-repository{,-impl}.ts`, `contact-form.vue`, `contact-creation-dialog.vue`, `contact-detail-view.vue`, `contact-chip.vue`, `contacts-list-sheet.vue`, `use-phone-actions.ts` consumers.
- **DB**: no column change. New Postgres function `set_primary_phone(p_contact_id, p_method_id)` added via migration to guarantee transactional primary flip. Consider a partial unique index `(contact_id) WHERE method_type='phone' AND is_primary` as follow-up; not in scope here.
- **Tests**: update vCard parser tests (multi-TEL fixtures), contact store tests (multi-phone add, primary switching), component tests for contact form/detail.
- **Deps**: none.
- **Data**: existing contacts with a single phone remain valid; rows without `is_primary` fall through to legacy first-phone behavior.
