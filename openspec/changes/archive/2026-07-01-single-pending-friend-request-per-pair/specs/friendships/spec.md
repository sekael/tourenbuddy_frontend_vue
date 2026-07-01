## ADDED Requirements

### Requirement: At most one pending friend request per unordered pair

The system SHALL permit at most one `friend_requests` row with `status = 'pending'` for any unordered pair of users `{A, B}`, regardless of direction. This MUST be enforced declaratively by a partial unique index on `(LEAST(from_user_id, to_user_id), GREATEST(from_user_id, to_user_id)) WHERE status = 'pending'`, replacing the prior directional `(from_user_id, to_user_id)` index. Pre-existing dual-pending pairs MUST be deduplicated by the same migration before the index is created: for each violating pair, the earliest row (`created_at`, tie-broken by `id`) is retained and every other pending row is set to `status = 'cancelled', responded_at = now()`.

#### Scenario: Reciprocal pending insert rejected

- **WHEN** a pending row `A→B` exists and an insert of `B→A` with `status = 'pending'` is attempted
- **THEN** the insert is rejected by the unordered partial unique index

#### Scenario: Existing dual-pending rows deduplicated on migration

- **WHEN** the migration runs and both `A→B` and `B→A` pending rows already exist
- **THEN** only the earliest of the two remains `pending` and the other becomes `status = 'cancelled'` with `responded_at` set, before the unordered index is created

#### Scenario: Terminal-status rows never collide

- **WHEN** a pair has any number of `friend_requests` rows in `status` `{accepted, denied, cancelled}` and a new `pending` row is inserted for that pair
- **THEN** the insert succeeds, because the unique index is restricted to `status = 'pending'`

### Requirement: Accepting a request resolves the opposite-direction pending row

`accept_friend_request(p_request_id)` MUST, in the same transaction as forming the friendship, terminate any opposite-direction pending row for the same pair by setting it to `status = 'cancelled', responded_at = now()`. This guarantees no dangling pending request survives an accept, including for legacy dual-pending data. The operation MUST be idempotent — a no-op when no opposite-direction pending row exists — and MUST NOT modify rows whose status is not `pending`.

#### Scenario: Opposite pending cancelled on accept

- **WHEN** user B accepts a pending request `A→B` while a pending row `B→A` also exists
- **THEN** the friendship `{A, B}` is created and the `B→A` row becomes `status = 'cancelled'` with `responded_at` set, in the same transaction

#### Scenario: No opposite row is a no-op

- **WHEN** user B accepts a pending request `A→B` and no `B→A` pending row exists
- **THEN** the friendship is created and no other `friend_requests` row is modified

### Requirement: Send affordance toward a pending requester resolves by accepting

When the current user is offered a connect affordance toward a matched user who already has a **pending incoming** request to the current user, the UI MUST present an "accept" action that resolves that existing request (calling the accept path) rather than a "send" action that would create a reciprocal pending row. Detection MUST be from client store state (the caller's incoming-request list). On success the UI MUST display an explicit inline disclaimer that the users are now friends, and the responded notification to the original requester MUST fire exactly as it does for an explicit accept. The contact-flow gating that selects a match for the connect prompt MUST surface incoming-pending matches (not only suppress outgoing-pending ones) so this affordance is reachable from the add-contact and contact-detail flows.

#### Scenario: Connect prompt switches to accept for an incoming pending request

- **WHEN** the current user views a connect affordance toward user B and a pending request `B→(current user)` exists in store state
- **THEN** the affordance is an "Accept friend request" action bound to that incoming request, not a "Send request" action

#### Scenario: Accepting via the prompt shows the now-friends disclaimer and notifies

- **WHEN** the current user activates the accept affordance toward user B
- **THEN** the friendship `{current user, B}` is formed, an inline "you are now friends" confirmation is shown in place, and the friend-request-responded notification is dispatched to B

#### Scenario: Concurrent cross-send is rejected with a retry prompt

- **WHEN** `sendRequest` toward user B is rejected by the unordered pending unique index because B's request to the current user arrived concurrently
- **THEN** the optimistic outgoing row is rolled back and the user is shown a failure message prompting them to retry; no duplicate pending row persists, and reopening the affordance after the incoming request propagates presents the accept action

## MODIFIED Requirements

### Requirement: Re-establishing the link allows new friend requests

After automatic termination, the unordered partial unique index on pending pairs MUST NOT block re-sending a new friend request between the same two users once the actor restores the link (re-adds the contact, re-adds the phone, or re-verifies their own phone). Because the index is restricted to `status = 'pending'`, terminal-status rows (`cancelled`, `denied`, `accepted`) from the prior relationship never collide with a new pending row in either direction.

#### Scenario: Re-adding contact allows new pending request

- **WHEN** a pending row was auto-cancelled by contact deletion, then the actor re-adds the contact and triggers a new friend request to the same user
- **THEN** insertion of the new pending row succeeds (terminal-status rows do not collide with the pending-only unique index)
