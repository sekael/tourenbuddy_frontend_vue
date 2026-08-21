## MODIFIED Requirements

### Requirement: Offline mutations are queued durably, coalesced per entity

The system SHALL persist offline mutations to a durable IndexedDB queue holding at
most **one entry per entity**, carrying a serializable representation of the
entity's final desired state (or a delete) plus any binary payload (e.g. a GPX
file), sufficient to replay it as a single idempotent operation. Repeated offline
mutations of the same entity SHALL coalesce into that one entry. Entries SHALL carry
an ordering key so that, across different entities, replay honours foreign-key
dependencies. The mutation of local state and its queue entry SHALL be persisted
atomically (a single transaction), so cached state and the queue never disagree.

A mutation SHALL also be queued — not attempted against the server — whenever the
current session is unverified (restored from storage without a successful token
refresh), regardless of the reachability signal. A write attempted on an unverified
session would be rejected by the server and lost to an error state; queueing it keeps
the user's edit durable until the session is real.

#### Scenario: Write while the session is unverified but the device reports online

- **WHEN** the user edits an entity while the app is running on a restored session whose
  token refresh has not yet succeeded, and the connectivity signal reports online
- **THEN** the mutation SHALL be queued and applied optimistically exactly as an offline
  write, and SHALL NOT be sent to the server or surfaced as a failed edit

#### Scenario: Queue persists across reloads

- **WHEN** a mutation is queued offline and the app is closed and reopened
- **THEN** the queued entry is still present and pending replay, consistent with the
  cached state

#### Scenario: Create then edit coalesce to one entry

- **WHEN** an entity is created offline and then edited offline
- **THEN** the queue holds a single entry for it representing the final state, which
  replays as one idempotent create

#### Scenario: Create then delete annihilate

- **WHEN** an entity is created offline and then deleted offline
- **THEN** its queue entry is removed entirely and nothing is replayed for it (the
  row never reached the server)

#### Scenario: Edit then revert to the server baseline annihilate

- **WHEN** a field is edited offline and then edited back to its last-synced server
  value (e.g. a notification toggle flipped and flipped back)
- **THEN** the coalesced update nets to the pre-edit snapshot, its queue entry is
  removed, and nothing shows as pending or replays

#### Scenario: Notification preferences are queued offline

- **WHEN** the push or email notification preference (or a per-type mute) is toggled
  offline
- **THEN** the change is applied optimistically, queued under its own entry, and
  replayed on reconnect — the push browser/server subscription is reconciled to the
  synced flag at replay time, since it cannot be registered while offline

#### Scenario: Cross-entity dependency order

- **WHEN** a contact is created offline and a tour referencing it is created offline
- **THEN** on replay the contact is written before the tour

#### Scenario: Binary payload retained

- **WHEN** an offline tour creation includes a GPX file
- **THEN** the file is stored with the queue entry and uploaded on replay

### Requirement: Queue is replayed on reconnect, before the reconnect refetch

When connectivity returns, the system SHALL drain the queue by replaying each entry
as a **single idempotent operation** (a create or update of the entity's final
state, or a delete) plus its file upload and deferred notification, in cross-entity dependency
order. The drain SHALL complete before the reconnect refetch overwrites the store
and cache, so freshly-flushed writes are never clobbered by a stale server snapshot.

A drain SHALL NOT run without an authenticated session. When no session is available —
including while a restored-but-unverified session is still awaiting its first successful
token refresh — the drain SHALL abort without consuming an entry's retry budget, leaving
every entry pending for a later attempt.

#### Scenario: Flush precedes refetch

- **WHEN** the device reconnects with queued writes and the realtime channels
  re-subscribe
- **THEN** the queue is drained first and the subsequent refetch reflects the
  flushed writes rather than overwriting them

#### Scenario: Replay as one idempotent operation

- **WHEN** a queued tour entry is replayed
- **THEN** it is written via a single idempotent create (or update), the GPX file uploaded
  (best-effort), and the notification dispatched — equivalent to having performed the
  action online, and safe to retry without duplication

#### Scenario: Drain triggered while the session is still unverified

- **WHEN** connectivity returns and a flush is triggered while the app is running on a
  restored session whose token refresh has not yet succeeded
- **THEN** the drain SHALL abort immediately, no entry's attempt count SHALL be
  incremented, and no entry SHALL be dead-lettered as a result

#### Scenario: Queued writes survive a re-authentication

- **WHEN** a session restored offline is ultimately rejected, the user signs in again as
  the same user, and writes are still pending in the queue
- **THEN** those writes SHALL still be present and SHALL be replayed under the new
  session

### Requirement: A reachability signal drives flushing energy-efficiently

The system SHALL derive a reachability predicate using cheap sources first — the
coarse online flag (whose true value is not treated as proof of reachability), the
realtime WebSocket connection state, and flush-attempt outcomes — resorting to an
explicit network health request only as a last tier when a write is pending and
cheaper signals are inconclusive, and SHALL NOT run a fixed background polling loop.
The authoritative event that kickstarts a flush SHALL be the realtime channel
reaching its subscribed state (proven reachability), the same event that gates the
reconnect refetch; app-foreground, a new enqueue while reachable, and **the arrival of a
valid session** (sign-in or successful token refresh) SHALL also trigger a flush. The
coarse online event SHALL NOT be the authoritative kickstart.

#### Scenario: Flush kickstarted by proven reachability, not the coarse flag

- **WHEN** the realtime channel (re)subscribes after being offline
- **THEN** a flush is kickstarted, and it is this proven-reachable event — not the
  coarse online flag — that drives it, with no periodic background polling

#### Scenario: Flush on foreground

- **WHEN** the app returns to the foreground with queued writes
- **THEN** a flush is attempted

#### Scenario: Flush when the session becomes valid

- **WHEN** a token refresh succeeds, or the user completes a sign-in, while writes are
  pending
- **THEN** a flush is kickstarted at that moment rather than waiting for the next
  reachability event
