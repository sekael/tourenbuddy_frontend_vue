## ADDED Requirements

### Requirement: Store-loaded collections are cached locally for offline read

The system SHALL persist a last-known-good local copy of each in-scope
store-loaded collection — owned tours, friend tours, contacts, user profile,
calendar availability, and friendships — so that they render when the device is
offline. Cached data SHALL be namespaced per authenticated user so one account
never reads another account's cache. The cache SHALL use IndexedDB and add no new
runtime dependency.

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

While offline, the system SHALL prevent data mutations (create/update/delete of
tours, contacts, profile, availability, and friendship actions) at the store-action
level and SHALL inform the user that the action is unavailable offline. It SHALL
NOT partially apply, silently drop, or persist a queued offline mutation in this
change.

#### Scenario: Mutation attempted offline

- **WHEN** the user attempts to create, edit, or delete data while offline
- **THEN** the mutation does not run and a localized "unavailable offline" notice
  is shown

#### Scenario: No partial offline write

- **WHEN** a mutation is blocked offline
- **THEN** no local or backend state is changed and nothing is queued for later
  replay
