## ADDED Requirements

### Requirement: Realtime synchronization of contacts and contact methods

The system SHALL keep the authenticated user's contacts list — including phone/email `contact_methods` — in sync across the user's devices in real time, without a page reload, by subscribing to Supabase Realtime `postgres_changes` on `public.contacts` and `public.contact_methods`, each filtered to the authenticated user via `user_id=eq.${currentUserId}`.

#### Scenario: Contact created on device A appears on device B
- **WHEN** the user creates a contact on device A while device B is signed in as the same user
- **THEN** device B's contacts list reflects the new contact within one debounce window, without a page reload

#### Scenario: Contact field edit reflects on device B
- **WHEN** the user edits a contact's name / display name on device A
- **THEN** device B reflects the change within one debounce window

#### Scenario: Phone/email-only edit reflects on device B
- **WHEN** the user adds, edits, removes, or re-prioritises a phone/email on device A without otherwise touching the `contacts` row
- **THEN** device B receives the `contact_methods` event and refetches, so the method change is reflected within one debounce window

#### Scenario: Contact deleted on device A disappears on device B
- **WHEN** the user deletes a contact on device A
- **THEN** device B receives the DELETE event and removes the contact, and any tour partnered with that contact drops the partner id locally via the existing `tours-store.$onAction(deleteContact)` reconciler

#### Scenario: Subscription gated on auth
- **WHEN** the user is not authenticated
- **THEN** no Realtime channel for contacts is open

#### Scenario: Clean teardown on sign-out
- **WHEN** the user signs out
- **THEN** the contacts Realtime channel is removed and the local contacts list is cleared

### Requirement: Contacts store uses the shared realtime primitive

The `contacts-store` MUST NOT call `supabase.channel(...)` or `supabase.removeChannel(...)` directly. It SHALL wire Realtime via `src/core/realtime/use-realtime-subscription.ts`, supplying:
- a channel key of the form `contacts-${currentUserId}`,
- two bindings — `contacts` and `contact_methods` — each with `event: '*'` and filter `user_id=eq.${currentUserId}`,
- an `onChange` callback that debounces a full `loadContacts()` refetch,
- an `onSubscribed` callback that runs `loadContacts()` once after `SUBSCRIBED`.

#### Scenario: Store consumes the primitive
- **WHEN** the contacts store wires Realtime
- **THEN** it invokes `useRealtimeSubscription` and no direct `supabase.channel` / `supabase.removeChannel` call exists in the store

#### Scenario: Baseline fetch runs after SUBSCRIBED
- **WHEN** the channel reaches `SUBSCRIBED`
- **THEN** the primitive invokes `loadContacts()` exactly once per subscribe cycle

### Requirement: contact_methods carries a consistent denormalised user_id

`public.contact_methods` SHALL have a `user_id` column that is always equal to the `user_id` of the contact referenced by its `contact_id`. The value SHALL be derived server-side (a `BEFORE INSERT OR UPDATE` trigger reading the parent `contacts` row) and MUST NOT be trusted from client input. The invariant SHALL additionally be enforced declaratively by a composite foreign key `(contact_id, user_id) → contacts(id, user_id) ON DELETE CASCADE`, so it holds by construction independent of write path. To keep the PostgREST `contacts → contact_methods(*)` embed unambiguous, this composite FK SHALL REPLACE the single-column `contact_id` FK (exactly one relationship between the table pair). The column exists to enable a user-scoped Realtime filter; it does NOT replace or widen RLS — `contact_methods_select_own` remains the sole authorization gate.

#### Scenario: Insert derives user_id from the parent contact
- **WHEN** a `contact_methods` row is inserted (with any or no client-supplied `user_id`)
- **THEN** its stored `user_id` equals the `user_id` of the contact identified by `contact_id`

#### Scenario: Reparenting update keeps user_id consistent
- **WHEN** a `contact_methods` row's `contact_id` is updated to a contact owned by a different user
- **THEN** the trigger re-derives `user_id` to match the new parent contact's owner

#### Scenario: Mismatched pair is structurally rejected
- **WHEN** a write attempts (e.g. bypassing the trigger) to set `(contact_id, user_id)` to a pair that does not match a real contact
- **THEN** the composite foreign key rejects the write

#### Scenario: Embed stays unambiguous
- **WHEN** the client issues `from('contacts').select('*, contact_methods(*)')`
- **THEN** PostgREST resolves exactly one `contacts ↔ contact_methods` relationship and the embed succeeds

#### Scenario: No row ever drifts
- **WHEN** the consistency check `count(*) from contact_methods cm join contacts c on c.id = cm.contact_id where cm.user_id <> c.user_id` is run after any sequence of writes
- **THEN** the count is `0`

### Requirement: Realtime replication enabled for contacts tables

The database SHALL include `public.contacts` and `public.contact_methods` in the `supabase_realtime` publication, both with `REPLICA IDENTITY FULL`, RLS remaining the sole authorization gate (no policy widening).

#### Scenario: Tables are members of supabase_realtime
- **WHEN** the publication is inspected after migrations are applied
- **THEN** `public.contacts` and `public.contact_methods` are members of `supabase_realtime`

#### Scenario: Replica identity is FULL
- **WHEN** `pg_class.relreplident` is inspected for either table
- **THEN** the value is `'f'` (FULL), so DELETE/UPDATE payloads carry `user_id` for filter matching

#### Scenario: RLS still gates visibility
- **WHEN** an authenticated client subscribes on either table
- **THEN** it receives only events for rows its existing SELECT RLS policies already permit

### Requirement: Realtime handler MUST NOT dispatch notifications

Contacts Realtime event handlers MUST NOT trigger any notification dispatch (push or email). Realtime remains a UI-sync pathway only.

#### Scenario: No notification dispatch from Realtime
- **WHEN** any `postgres_changes` event for `contacts` / `contact_methods` is received
- **THEN** no notification dispatch function is invoked from the `onChange` handler
