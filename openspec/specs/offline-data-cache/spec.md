## ADDED Requirements

### Requirement: Store-loaded collections are cached locally for offline read

The system SHALL persist a last-known-good local copy of each in-scope
store-loaded collection — owned tours, friend tours, contacts, user profile,
calendar availability, friendships, and the user id → registered phone lookup — so that
they render when the device is offline. Cached data SHALL be namespaced per authenticated
user so one account never reads another account's cache. The cache SHALL use IndexedDB and
add no new runtime dependency.

The user id → phone lookup SHALL be written through whenever a lookup adds entries to it,
and SHALL be read back before any consumer resolves a name from it. Merging the cached
lookup into the in-memory one SHALL NOT overwrite entries already resolved in the current
session, since a live lookup answer is fresher than a cached one. Names resolved through
that lookup SHALL NOT be cached separately — they are derived from the cached contacts
collection, which remains their single source.

#### Scenario: Cached data renders offline

- **WHEN** the user has previously loaded their tours/contacts/profile/calendar/
  friendships while online, then opens the app with no connectivity
- **THEN** those collections render from the local cache instead of appearing empty

#### Scenario: No cache yet, offline

- **WHEN** the user opens a collection offline that has never been loaded online on
  this device
- **THEN** the store surfaces an empty/loading-failed state via its existing
  `error` handling, without crashing

#### Scenario: Per-user isolation

- **WHEN** a second account signs in on the same device
- **THEN** it does not read the first account's cached collections

#### Scenario: Friend names survive offline

- **WHEN** the user has viewed friend tours online, then opens the friends list with no
  connectivity
- **THEN** each friend tour still names its owner, by resolving the cached phone lookup
  against the cached contacts collection, rather than degrading to the generic fallback

#### Scenario: Live lookup beats the cached phone entry

- **WHEN** a phone lookup resolves for a user id during the session and the cache is
  hydrated afterwards with a stale entry for that same id
- **THEN** the session's resolved value is kept and the stale cached entry is discarded

#### Scenario: Renamed contact is reflected offline

- **WHEN** the user renames a contact while offline and then views that friend's tour
- **THEN** the new name is shown, because the name is read from the contacts collection
  rather than from a cached copy of the resolved name

#### Scenario: Phone lookup cache unavailable

- **WHEN** the read or write to IndexedDB fails (quota, private browsing)
- **THEN** name resolution degrades to live lookups only, and no consumer errors or hangs

### Requirement: Loads hydrate from cache then refetch when online

Each in-scope `loadX()` action SHALL read the cached snapshot first and assign it
to the store immediately, then, only when online, refetch from the backend, assign
the fresh result, and overwrite the cache with it. When offline, no network
request SHALL be attempted and the cached snapshot SHALL stand as the result.

#### Scenario: Instant paint then refresh online

- **WHEN** a store loads while online and a cached snapshot exists
- **THEN** the cached snapshot is shown first, then replaced by fresh backend data,
  and the cache is overwritten with the fresh data

#### Scenario: Offline load skips the network

- **WHEN** a store loads while offline
- **THEN** the cached snapshot is used and no backend request is made

#### Scenario: Online fetch fails, cache stands

- **WHEN** a store loads while reported online but the backend request fails
- **THEN** the previously cached snapshot remains shown rather than blanking the
  store, and the error is recorded per the store's `error` contract

### Requirement: A single online/offline signal drives stores and UI

The system SHALL expose one reactive online/offline signal derived from
`navigator.onLine` and the `online` / `offline` window events, shared as a
module-level singleton. Stores SHALL consult it to decide whether to hit the
network; the UI SHALL consult it to indicate offline state to the user.

#### Scenario: Transition to offline is observed

- **WHEN** the device loses connectivity
- **THEN** the shared signal reports offline and the UI surfaces an offline
  indicator

#### Scenario: Transition to online is observed

- **WHEN** the device regains connectivity
- **THEN** the shared signal reports online and network-backed loads resume

### Requirement: Reconnect reconciles the cache via the existing realtime refetch

On regaining connectivity, the system SHALL refresh cached collections through the
existing Realtime re-subscription refetch path (the `onSubscribed` full refetch)
rather than a separate sync mechanism, overwriting the cache with fresh backend
state. No independent offline sync engine SHALL be introduced in this change.

#### Scenario: Cache refreshed after reconnect

- **WHEN** the device comes back online and the realtime channels re-subscribe
- **THEN** the affected stores refetch and overwrite their cached snapshots with
  current backend data

### Requirement: Offline data mutation handling

While offline, the system SHALL queue data mutations (create/update/delete of
tours, contacts, profile, availability, and unfriend) durably, apply them
optimistically to local state and the read cache, and replay them automatically when
connectivity returns. It SHALL NOT silently drop an offline mutation. Friend tours
remain read-only and SHALL NOT be queued. Friend **request** actions (send / accept /
decline / cancel a request) remain online-only: they depend on live lookups that
cannot run offline, SHALL NOT be queued, and their action controls SHALL be disabled
offline. Mutations made while online SHALL behave exactly as before (no queue
involvement).

#### Scenario: Mutation made offline is queued and shown

- **WHEN** the user creates, edits, or deletes in-scope data while offline
- **THEN** the change is persisted to the durable write queue, reflected
  optimistically in the UI and the read cache, and the user is told it is saved
  offline and will sync

#### Scenario: Queued mutation survives an offline reload

- **WHEN** the app is reloaded while still offline after a queued mutation
- **THEN** the optimistic change is still shown (from the cache write-through) and
  the mutation is still queued for replay

#### Scenario: Friend tour is never queued

- **WHEN** the user views a friend's tour offline
- **THEN** no write action is offered and nothing is enqueued for it

#### Scenario: Friend-request actions are unavailable offline

- **WHEN** the user opens the friend-requests sheet or a connect prompt while offline
- **THEN** the send / accept / decline / cancel / block controls are disabled, an
  online-only hint is shown, and nothing is enqueued for any friend-request action

#### Scenario: Unfriend made offline is queued

- **WHEN** the user unfriends a contact while offline
- **THEN** the friendship is removed optimistically, the removal is persisted to the
  write queue (with its tour-link eviction recipients snapshotted), and it replays on
  reconnect

#### Scenario: Online mutation bypasses the queue

- **WHEN** the user performs a mutation while online
- **THEN** it is applied directly to the backend with no queue entry created
