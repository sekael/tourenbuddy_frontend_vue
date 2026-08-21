## MODIFIED Requirements

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
