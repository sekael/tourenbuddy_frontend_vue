## Context

`Tour.partnerIds` is fetched via `tours_view` and cached in `useToursStore.tours`. Contact deletion (`useContactsStore.deleteContact`) removes the row from `contacts`, and Postgres cascades the matching `tour_partners` rows. The server side is correct: subsequent reads of `tours_view` return updated `partnerIds`.

The client cache, however, is not refreshed. The tour edit flow rebuilds `TourDraft.partnerIds` from `tours.value`, which still contains the deleted contact's UUID. Saving calls `repository.updateTour` → `update_tour_full(..., p_partner_ids=[...stale uuid...])`, which fails with a foreign-key violation. The user sees a generic save error and cannot save until they re-open the tour after a full reload.

The fix needs to keep the two stores in sync without violating the architectural rule that features couple via shared composables or Pinia subscriptions, not direct cross-feature imports of repositories or domain entities.

## Goals / Non-Goals

**Goals:**

- After a successful `contactsStore.deleteContact`, every cached tour's `partnerIds` no longer contains the deleted contact id.
- No extra network round-trip (no full tours reload).
- Failure of `deleteContact` (rejected promise) leaves the tours cache untouched.
- The tours store remains the single owner of mutations to `tours.value`.
- Codify the existing invariant that tour-feature views resolve partner details live from the contacts store, so contact renames and contact-method mutations propagate without explicit cross-store reconciliation.

**Non-Goals:**

- Server-side changes (none needed; cascade already works).
- Optimistic UI for contact deletion (out of scope for this fix).
- Reacting in the tours store to non-deletion contact mutations (rename, method add/update/remove). These already propagate through shared `contactsStore.contacts` reactivity — no tours-side handler is needed or wanted.
- Persisting reconciliation across reloads (cache is per-session and re-fetched on auth).

## Decisions

### 1. Tours store subscribes to contacts store via `$onAction`

Inside `useToursStore`'s setup function, obtain the contacts store with `useContactsStore()` and register `contactsStore.$onAction(({ name, args, after }) => { ... })`. On `name === 'deleteContact'`, register an `after` callback (Pinia only fires `after` when the action resolves successfully) that removes `args[0]` from every cached tour's `partnerIds`.

**Why this over alternatives:**

- _Direct call from `contactsStore.deleteContact` into `useToursStore`_: reverses the dependency direction (contacts feature would import tours), violating module boundaries from `architecture.md`.
- _Page-level orchestration in `contact-detail-view.vue`_: easy to forget at any new deletion call site; not enforced by the type system.
- _Reload tours after every contact delete_: extra network call on the free-tier Supabase backend; user-visible latency; fights with optimistic patterns elsewhere.
- _Subscribe to `contacts.value` via `watch`_: reacts to any list change (load, add, update) and would require diffing the previous list to detect deletions — noisier and more error-prone than `$onAction`.

`$onAction`'s `after` runs only on resolved promises, so a failed delete naturally leaves the cache untouched.

### 2. Reconciliation runs once per store instance

The subscription is registered inside the tours store setup and is implicitly torn down when the Pinia instance is disposed (e.g., test teardown, app reload). No manual cleanup is needed because the contacts store and tours store share the same Pinia instance lifecycle.

### 3. No reconciliation for non-deletion contact mutations

Tour partner chips in `tour-info-sheet.vue` derive `partners` as `contacts.value.filter(c => tour.partnerIds.includes(c.id))` against the live `useContactsStore.contacts` ref. Contact-method action menus and primary-phone resolution likewise read from the live `Contact` object. Every contacts-store mutation (`updateContact`, `addMethodToContact`, `updateMethodOnContact`, `setPrimaryPhoneOnContact`, `removeMethodFromContact`) updates `contacts.value` in place, so Vue reactivity propagates the new value to all subscribers on the next tick — including any open tour view.

This means **no tours-side handler is needed for non-deletion mutations**. Adding one would be redundant work and risks drift between sources of truth. The spec captures this as a forward-looking invariant: the `Tour` entity must remain a foreign-key holder (`partnerIds: string[]`), never a partner-snapshot container, so the live-dereference pattern keeps working.

### 4. Mutation produces a new `tours` array only when needed

To avoid unnecessary reactivity churn, the handler short-circuits when no cached tour references the deleted contact id. When at least one tour is affected, it produces a new `tours.value` array with new `Tour` objects only for the affected entries (others are referentially preserved) — consistent with the pattern in existing actions (`updateTour`, `setCompleted`).

## Risks / Trade-offs

- **Tours store may not be instantiated when a contact is deleted** → If a user deletes a contact before ever opening the map/tours view, `useToursStore` is never created and the subscription never registers. This is acceptable: with no cached tours, there is nothing stale to fix; the next tours load will fetch fresh data with the cascade already applied.
- **Coupling direction (tours depends on contacts at runtime)** → Mitigation: the dependency is one-way and purely runtime via the Pinia registry; no domain or data-layer imports. Tour entities already reference contact ids by value, so the conceptual dependency already exists.
- **Test ordering: contacts store must exist before tours store registers the subscription** → `useContactsStore()` is called inside `useToursStore`'s setup; Pinia lazily instantiates it. Unit tests that exercise the subscription must instantiate the tours store and then call `contactsStore.deleteContact`.
- **Silent contract: contacts store action name is referenced as a string** → Mitigation: cover with a unit test that fails if the action is renamed without updating the subscriber.
