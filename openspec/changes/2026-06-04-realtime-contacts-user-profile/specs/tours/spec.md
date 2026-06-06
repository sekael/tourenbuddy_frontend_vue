## ADDED Requirements

### Requirement: Tour partner set reconciles across devices on contact delete

When a partnered contact is deleted, the DB cascade removes the corresponding `tour_partners` rows. The system SHALL reconcile the affected tours' partner ids on **every** signed-in device of the owner in real time — not only the device that performed the delete. This SHALL be achieved by including `public.tour_partners` in the `supabase_realtime` publication and binding it in `tours-store` so a `tour_partners` change triggers a debounced `loadTours()`.

The existing local `tours-store.$onAction(deleteContact)` reconciler MAY remain for optimistic update latency on the editing device, but MUST NOT be the sole reconciliation path (it does not fire on remote devices, which receive a `loadContacts()` refetch rather than the `deleteContact` action).

#### Scenario: Remote device reconciles partner ids
- **WHEN** device A deletes a contact that is a partner on a tour, and device B (same user) has never run the `deleteContact` action
- **THEN** device B receives the `tour_partners` DELETE event and the tour drops the partner id within one debounce window

#### Scenario: Partner change coalesces with tour change
- **WHEN** a partner-set edit on device A touches both `tours` (via `update_tour_full`) and `tour_partners`
- **THEN** device B coalesces both events into a single debounced `loadTours()` (one channel, two bindings)

### Requirement: tour_partners carries a consistent denormalised user_id

`public.tour_partners` SHALL have a `user_id` column always equal to the `user_id` of the tour referenced by its `tour_id`, derived server-side by a `BEFORE INSERT OR UPDATE` trigger and never trusted from client input. The invariant SHALL be enforced declaratively by a composite foreign key `(tour_id, user_id) → tours(id, user_id) ON DELETE CASCADE`, which REPLACES the single-column `tour_id` FK. The `contact_id → contacts(id) ON DELETE CASCADE` FK SHALL be KEPT (different parent — it is the contact-delete cascade that drives cross-device reconciliation). The column enables a user-scoped Realtime filter and does NOT replace or widen RLS — `tour_partners_select_own` remains the sole authorization gate.

#### Scenario: Insert derives user_id from the parent tour
- **WHEN** a `tour_partners` row is inserted (with any or no client-supplied `user_id`)
- **THEN** its stored `user_id` equals the `user_id` of the tour identified by `tour_id`

#### Scenario: Mismatched pair is structurally rejected
- **WHEN** a write attempts to set `(tour_id, user_id)` to a pair that does not match a real tour
- **THEN** the composite foreign key rejects the write

#### Scenario: Contact-delete cascade still fires
- **WHEN** a contact partnered on a tour is deleted
- **THEN** the `tour_partners` rows referencing it are cascade-deleted via the retained `contact_id` FK

#### Scenario: No row ever drifts
- **WHEN** the consistency check `count(*) from tour_partners tp join tours t on t.id = tp.tour_id where tp.user_id <> t.user_id` is run after any sequence of writes
- **THEN** the count is `0`

### Requirement: Realtime replication enabled for tour_partners

The database SHALL include `public.tour_partners` in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, RLS remaining the sole authorization gate. The binding SHALL be filtered `user_id=eq.${currentUserId}` and wired as a second binding on the existing `tours-${currentUserId}` channel.

#### Scenario: Table is a member of supabase_realtime
- **WHEN** the publication is inspected after migrations are applied
- **THEN** `public.tour_partners` is a member of `supabase_realtime` and its `relreplident` is `'f'`

#### Scenario: DELETE event carries user_id for filter matching
- **WHEN** a `tour_partners` row is deleted (including via contact-delete cascade)
- **THEN** `REPLICA IDENTITY FULL` ships the row's `user_id` so the `user_id=eq` filter delivers the DELETE to the owner
