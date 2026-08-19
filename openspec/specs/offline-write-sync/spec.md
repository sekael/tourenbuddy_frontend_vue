## ADDED Requirements

### Requirement: Offline mutations are queued durably, coalesced per entity

The system SHALL persist offline mutations to a durable IndexedDB queue holding at
most **one entry per entity**, carrying a serializable representation of the
entity's final desired state (or a delete) plus any binary payload (e.g. a GPX
file), sufficient to replay it as a single idempotent operation. Repeated offline
mutations of the same entity SHALL coalesce into that one entry. Entries SHALL carry
an ordering key so that, across different entities, replay honours foreign-key
dependencies. The mutation of local state and its queue entry SHALL be persisted
atomically (a single transaction), so cached state and the queue never disagree.

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

### Requirement: Offline mutations can be discarded with immediate revert

The system SHALL let the user discard a pending or dead-lettered offline mutation
and SHALL revert the affected entity's local state immediately, without waiting for
a reconnect or refetch. Discarding SHALL remove the entity's queue entry and restore
its cached state to the pre-edit baseline (or remove it entirely if it was created
offline), atomically.

#### Scenario: Discard a pending edit offline

- **WHEN** the user discards an offline edit while still offline
- **THEN** the entity immediately shows its pre-edit state and no entry remains
  queued for it

#### Scenario: Discard an offline-created entity

- **WHEN** the user discards an entity that was created offline
- **THEN** the entity is removed from local state and nothing remains queued for it

### Requirement: Queue is replayed on reconnect, before the reconnect refetch

When connectivity returns, the system SHALL drain the queue by replaying each entry
as a **single idempotent operation** (a create or update of the entity's final
state, or a delete) plus its file upload and deferred notification, in cross-entity dependency
order. The drain SHALL complete before the reconnect refetch overwrites the store
and cache, so freshly-flushed writes are never clobbered by a stale server snapshot.

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

### Requirement: Notifications for queued writes are deferred until replay

The system SHALL NOT dispatch a notification at the time an offline mutation is
enqueued. It SHALL dispatch the notification only when the mutation's replay
succeeds, and exactly once.

#### Scenario: No notification while offline

- **WHEN** a shareable tour is created offline
- **THEN** no notification is dispatched until the write replays successfully

#### Scenario: Notification fires once on replay

- **WHEN** the queued write replays successfully
- **THEN** its notification is dispatched exactly once

### Requirement: Conflicts resolve by row-level last-write-wins with the loser surfaced

On replay, an **update** that conflicts with a newer server change to the same row
SHALL be resolved by row-level last-write-wins keyed on the row's update timestamp.
A local update that loses SHALL be surfaced to the user, not silently discarded. A
queued **delete** SHALL replay unconditionally (it does not participate in the
timestamp compare). A queued **update** SHALL NOT recreate a row that was deleted on
the server; it SHALL fail to the dead-letter instead.

#### Scenario: Local update wins

- **WHEN** a queued edit replays and the server row was not changed more recently
- **THEN** the local edit is applied

#### Scenario: Server wins, user informed

- **WHEN** a queued edit replays but the server row was changed more recently
- **THEN** the local edit is not applied and the user is informed a newer version
  exists

#### Scenario: Delete wins over a concurrent edit

- **WHEN** a queued delete replays and the server row was edited meanwhile
- **THEN** the delete is applied

#### Scenario: Update does not resurrect a deleted row

- **WHEN** a queued edit replays but the row was deleted on the server
- **THEN** the row is not recreated and the entry is dead-lettered as no-longer-present

### Requirement: A durable pending-sync indicator surfaces unsynced work

The system SHALL surface the count of pending offline writes on a durable indicator
read from the queue on every launch. The transient "N changes waiting to sync" text
SHALL appear only when the queue transitions from empty to non-empty (the first
pending change); while writes are already queued, subsequent changes SHALL only
update the indicator's count, not re-show the text.

#### Scenario: Text shown only on the first pending change

- **WHEN** a first mutation is queued while the queue was empty
- **THEN** the "waiting to sync" text is shown briefly, then collapses to the count chip

#### Scenario: Later changes only bump the count

- **WHEN** a further mutation is queued while writes are already pending
- **THEN** the count increments without the text re-appearing

### Requirement: A reachability signal drives flushing energy-efficiently

The system SHALL derive a reachability predicate using cheap sources first — the
coarse online flag (whose true value is not treated as proof of reachability), the
realtime WebSocket connection state, and flush-attempt outcomes — resorting to an
explicit network health request only as a last tier when a write is pending and
cheaper signals are inconclusive, and SHALL NOT run a fixed background polling loop.
The authoritative event that kickstarts a flush SHALL be the realtime channel
reaching its subscribed state (proven reachability), the same event that gates the
reconnect refetch; app-foreground and a new enqueue while reachable SHALL also
trigger a flush. The coarse online event SHALL NOT be the authoritative kickstart.

#### Scenario: Flush kickstarted by proven reachability, not the coarse flag

- **WHEN** the realtime channel (re)subscribes after being offline
- **THEN** a flush is kickstarted, and it is this proven-reachable event — not the
  coarse online flag — that drives it, with no periodic background polling

#### Scenario: Flush on foreground

- **WHEN** the app returns to the foreground with queued writes
- **THEN** a flush is attempted

### Requirement: Permanent failures dead-letter without blocking the queue

The system SHALL retry transient replay failures with capped backoff and SHALL move
permanently-failing entries to a dead-letter that the user can review, retry, or
discard. A dead-lettered entry SHALL NOT block replay of the rest of the queue, and
entries dependent on a dead-lettered create SHALL also be dead-lettered.

#### Scenario: Transient failure retried

- **WHEN** a replay fails with a transient error
- **THEN** it is retried with backoff and does not dead-letter immediately

#### Scenario: Permanent failure dead-lettered, queue continues

- **WHEN** a replay fails permanently (validation, permission, missing entity, or
  conflict loss)
- **THEN** the entry moves to the dead-letter, the remaining queue continues to
  drain, and the user can retry or discard it

#### Scenario: Dependent entries cascade

- **WHEN** a queued create is dead-lettered
- **THEN** later queued edits/deletes for that same entity are dead-lettered too
  rather than replayed against a non-existent row

#### Scenario: Discarded write rolls back

- **WHEN** the user discards a dead-lettered mutation
- **THEN** its optimistic local state is reconciled away on the next refetch
