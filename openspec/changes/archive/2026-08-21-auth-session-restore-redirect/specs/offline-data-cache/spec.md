## MODIFIED Requirements

### Requirement: Loads hydrate from cache then refetch when online

Each in-scope `loadX()` action SHALL read the cached snapshot first and assign it
to the store immediately, then, only when the backend is **reachable**, refetch from the
backend, assign the fresh result, and overwrite the cache with it. When it is not
reachable, no network request SHALL be attempted and the cached snapshot SHALL stand as
the result.

The backend SHALL be considered unreachable both when the online signal reports offline
and while the current session is **unverified** (restored from storage without a
successful token refresh) — the same predicate that governs whether a mutation is
attempted or queued. This is not a precaution against a rejected request: every backend
request resolves its access token through the auth client first, so a request issued on
an unverified session does not fail fast but blocks behind the auth client's refresh
retries, stalling the caller and any bootstrap step awaiting it.

Because reads are skipped for the duration of an unverified session, the system SHALL
refetch the affected stores when that session becomes verified, rather than leaving them
on a cached snapshot until an unrelated event happens to refresh them.

#### Scenario: Instant paint then refresh online

- **WHEN** a store loads while online and a cached snapshot exists
- **THEN** the cached snapshot is shown first, then replaced by fresh backend data,
  and the cache is overwritten with the fresh data

#### Scenario: Offline load skips the network

- **WHEN** a store loads while offline
- **THEN** the cached snapshot is used and no backend request is made

#### Scenario: Load on an unverified session skips the network

- **WHEN** a store loads while the session is unverified and the device reports online
- **THEN** the cached snapshot is used, no backend request is made, and the load
  SHALL return promptly rather than waiting on the pending token refresh

#### Scenario: Stores refresh when the session is verified

- **WHEN** a session that was adopted unverified is subsequently proven valid by a
  successful token refresh
- **THEN** the stores whose reads were skipped SHALL refetch, so the user is not left
  viewing cached data on a connection that is now fully usable

#### Scenario: Online fetch fails, cache stands

- **WHEN** a store loads while reported online but the backend request fails
- **THEN** the previously cached snapshot remains shown rather than blanking the
  store, and the error is recorded per the store's `error` contract
