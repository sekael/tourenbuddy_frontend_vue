## MODIFIED Requirements

### Requirement: Offline data mutation handling

While offline, the system SHALL queue data mutations (create/update/delete of
tours, contacts, profile, and availability) durably, apply them optimistically to
local state and the read cache, and replay them automatically when connectivity
returns. It SHALL NOT silently drop an offline mutation. Friend tours remain
read-only and SHALL NOT be queued. All friendship actions (send / accept / decline /
cancel a request, unfriend) remain online-only: they depend on live lookups that
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

#### Scenario: Friendship actions are unavailable offline

- **WHEN** the user opens the friend-requests sheet or a connect prompt while offline
- **THEN** the send / accept / decline / cancel / block controls are disabled, an
  online-only hint is shown, and nothing is enqueued for any friendship action

#### Scenario: Online mutation bypasses the queue

- **WHEN** the user performs a mutation while online
- **THEN** it is applied directly to the backend with no queue entry created
