## Why

Deleting a contact removes it from `contacts` and cascades to `tour_partners` in the database, but the cached `Tour.partnerIds` arrays in the tours Pinia store retain the deleted contact's UUID. The next tour edit sends the stale UUID in `p_partner_ids` to `update_tour_full`, which fails with a foreign-key error and surfaces a save error to the user (issue #56).

## What Changes

- Tours store subscribes to the contacts store via `$onAction` and, after a successful `deleteContact`, removes the deleted contact ID from `partnerIds` of every cached tour.
- Codify the existing invariant that tour-related views MUST dereference partner details (name, phones, contact methods) live from the contacts store via `partnerIds`, and MUST NOT cache snapshots of `Contact` data inside `Tour` entities or tour-feature state. This guarantees that contact renames, contact-method edits, primary-phone changes, and method removals are immediately reflected in tour partner chips and call/messaging actions without explicit cross-store reconciliation.
- No repository, schema, or RPC changes — purely client-side cache reconciliation plus an explicit invariant.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tours`: tours store MUST keep cached `Tour.partnerIds` consistent with the contacts store after a contact deletion, and tour-feature views MUST resolve partner details live from the contacts store.

## Impact

- Code: `src/features/tours/presentation/stores/tours-store.ts` (new cross-store subscription); test additions under `test/features/tours/presentation/stores/`.
- No API, schema, or dependency changes.
- Cross-feature coupling: tours store gains a runtime dependency on contacts store (one-way; respects existing direction since tours already reference contact IDs).
