## Purpose

CRUD for personal contacts the user manages locally and links to tours and friend requests.

## Requirements

### Requirement: Delete-contact confirmation warns about friendship and pending-request side effects

When the user initiates contact deletion, the confirmation UI MUST detect whether deleting that contact will (a) cancel any pending `friend_requests` and/or (b) remove any existing `friendships` row between the current user and any registered user linked through the contact's phone `contact_methods`. If either applies, the confirmation dialog MUST display a localized warning identifying the side effect (pending request cancellation, friendship removal, or both).

#### Scenario: Warning shown when pending request exists
- **WHEN** the user opens the delete-contact confirmation for a contact whose phone resolves to a registered user with a pending friend request between the parties (and no friendship)
- **THEN** the confirmation dialog displays the localized "pending friend request will be cancelled" warning in addition to the standard delete message

#### Scenario: Warning shown when friendship exists
- **WHEN** the user opens the delete-contact confirmation for a contact whose phone resolves to a registered user with an existing friendship (and no pending request)
- **THEN** the confirmation dialog displays the localized "existing friendship will be removed" warning in addition to the standard delete message

#### Scenario: Warning shown when both exist
- **WHEN** both a pending request and a friendship exist for the contact's linked user
- **THEN** the confirmation dialog displays the localized combined warning

#### Scenario: No warning when no relationship
- **WHEN** the contact's phones do not resolve to a registered user, or resolve but no pending request and no friendship exist
- **THEN** the confirmation dialog shows only the standard delete message, with no relationship warning

#### Scenario: Confirming the delete performs cleanup
- **WHEN** the user confirms deletion of a contact for which the warning was displayed
- **THEN** the contact is deleted and the database removes the corresponding `friendships` row(s) and/or terminates pending `friend_requests` (per the `friendships` capability)

## MODIFIED Requirements

### Requirement: Contacts store

A Pinia store (`useContactsStore`) SHALL manage the list of contacts (including their contact methods) with reactive `contacts`, `isLoading`, and `error` state. The `addContact` action SHALL accept multiple phone entries and enforce the single-primary invariant on write.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the contacts store SHALL automatically fetch all contacts with their contact methods

#### Scenario: Add contact with multiple phones

- **WHEN** `addContact(firstName, lastName?, displayName?, phones?)` is called with `phones = [{ value: v1, isPrimary: true }, { value: v2, isPrimary: false }]`
- **THEN** the store SHALL create the contact, then insert both phone contact methods — the first with `is_primary = true`, the second with `is_primary = false` — add the full contact with ordered methods to the local list, and re-sort by firstName

#### Scenario: Add contact with one phone

- **WHEN** `addContact` is called with `phones = [{ value, isPrimary: true }]`
- **THEN** the store SHALL create the contact and a single phone method with `isPrimary: true`

#### Scenario: Add contact without phone

- **WHEN** `addContact` is called with no `phones` or with an empty array
- **THEN** the store SHALL create the contact with empty `contactMethods` array

#### Scenario: Add contact with multiple phones but none primary

- **WHEN** `addContact` is called with two or more phones and none is marked `isPrimary: true`
- **THEN** the store SHALL throw a validation error and SHALL NOT create the contact

#### Scenario: Store update reflects in list

- **WHEN** `updateContact` action completes successfully
- **THEN** the local contacts array is updated with the new data and re-sorted by first name

#### Scenario: Store delete reflects in list

- **WHEN** `deleteContact` action completes successfully
- **THEN** the contact is removed from the local contacts array immediately

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the contacts store SHALL clear its cached contacts list

### Requirement: Contact list item display

Each contact in the list SHALL display the resolved contact name (using existing `resolveContactName()` logic) and the primary phone number if available. Each row SHALL be tappable to navigate to the contact detail/edit view within the sheet.

#### Scenario: Contact with one phone number

- **WHEN** a contact has exactly one phone method
- **THEN** the list item shows the contact name and that phone number below it

#### Scenario: Contact with multiple phones

- **WHEN** a contact has multiple phone methods
- **THEN** the list item subtitle SHALL show the phone method marked `isPrimary: true`

#### Scenario: Contact without contact methods

- **WHEN** a contact has no contact methods (name only)
- **THEN** the list item shows the contact name with no secondary text

#### Scenario: Tap contact to open detail

- **WHEN** user taps a contact row in the list
- **THEN** the sheet navigates to the detail/edit view for that contact

## ADDED Requirements

### Requirement: Contacts list shows friendship icon

The contacts list row SHALL render a friendship icon next to the contact name when the contact is linked to an accepted friend, per the rule defined in the `contact-account-linking` capability. Implementation SHALL consume `useFriendshipsStore().friendUserIds` and SHALL NOT introduce a separate source of truth for friendship status.

#### Scenario: Linked contact shows icon

- **WHEN** a contact's normalized phone matches a friend user_id in the friendships store
- **THEN** the list row SHALL render the friendship icon

#### Scenario: Unlinked contact has no icon

- **WHEN** none of a contact's phones match any friend user_id
- **THEN** the list row SHALL NOT render the friendship icon

### Requirement: Delete disclaimer for linked contacts

When a user initiates deletion of a contact that is linked to an accepted friendship (i.e. one of the contact's phones matches a friend user ID), the delete confirmation UI SHALL display a warning that the friendship connection will also be removed. Upon confirming deletion, the system SHALL remove the friendship via the `removeFriendship` store action before deleting the contact. The friend icon SHALL no longer appear for that contact once the friendship is removed.

#### Scenario: Linked contact — disclaimer shown

- **WHEN** a user taps delete on a contact whose phone is linked to a TourenBuddy friendship
- **THEN** the confirmation state SHALL display a warning message explaining the friendship will be removed

#### Scenario: Linked contact — friendship removed on delete

- **WHEN** the user confirms deletion of a linked contact
- **THEN** the system SHALL call `removeFriendship(linkedFriendUserId)` and then delete the contact, and the friend icon SHALL no longer appear in the contacts list

#### Scenario: Unlinked contact — no disclaimer

- **WHEN** a user taps delete on a contact with no linked friendship
- **THEN** the confirmation state SHALL NOT show any friendship-related warning

### Requirement: Contacts store unaffected by friendship state

The contacts store SHALL NOT store, fetch, or cache friendship state. Friendship lookups SHALL remain in the `useFriendshipsStore`. The contacts list component SHALL combine the two stores reactively at the presentation layer.

#### Scenario: No friendship fields on contact entity

- **WHEN** a contact entity is read from the store
- **THEN** the entity SHALL contain no friendship-status fields

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
