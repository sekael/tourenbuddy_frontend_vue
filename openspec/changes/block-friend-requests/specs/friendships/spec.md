## ADDED Requirements

### Requirement: Friend request send path consults block state server-side

Sending a friend request SHALL go through the `send_friend_request(p_to_user_id uuid)` SECURITY INVOKER RPC. The RPC MUST raise `blocked_by_target` (`ERRCODE = 'P0001'`) when an active `user_blocks(p_to_user_id, auth.uid())` row exists; otherwise it inserts and returns the row. The `friend_requests` INSERT RLS policy MUST also carry the same block predicate as defense in depth, so any direct DML path (custom client, future code) is hard-rejected by Postgres. The client UI additionally hides the affordance based on `is_blocked_by(B)`.

#### Scenario: RPC raises typed error for blocked sender
- **WHEN** user A invokes `send_friend_request(B)` and an active `user_blocks(B, A)` row exists
- **THEN** the RPC raises `blocked_by_target` with `ERRCODE = 'P0001'` and no row is inserted

#### Scenario: Direct INSERT path also rejected by RLS
- **WHEN** any client bypasses the RPC and attempts to INSERT into `friend_requests` while a block exists
- **THEN** RLS denies the insert independently of the RPC

#### Scenario: Client hides affordance for blocked sender
- **WHEN** user A's client evaluates a send-request affordance toward user B and `is_blocked_by(B)` returns true
- **THEN** the affordance is not rendered

#### Scenario: Client invalidates cache on typed rejection
- **WHEN** the RPC raises `blocked_by_target` for target B
- **THEN** the client sets `isBlockedByCache[B] = true`, hides the affordance in the current view, and shows a generic failure snackbar (does not disclose the block reason)

### Requirement: Block on existing friend cascades unfriend + request termination

When user A blocks user B and a `friendships` row exists between them (in either column order) and/or pending `friend_requests` exist in either direction, the `block_user` RPC MUST in one transaction:
- delete the `friendships` row,
- terminate pending friend requests (cancelled if A was sender, denied if A was recipient),
- insert the `user_blocks(A, B)` row.

Partial application MUST NOT be possible.

#### Scenario: Block-while-friends cascade
- **WHEN** user A invokes `block_user(B)` while `friendships(A, B)` exists (and optionally pending requests)
- **THEN** the friendship is deleted, any pending requests are terminated per direction, and the block row is inserted — all in one transaction

#### Scenario: Pending-only cascade (no existing friendship)
- **WHEN** user A invokes `block_user(B)` while only a pending `friend_requests` exists
- **THEN** the pending request is terminated (denied if A is recipient, cancelled if A is sender) and the block row is inserted atomically

#### Scenario: Stranger-block (no prior relationship)
- **WHEN** user A invokes `block_user(B)` and neither friendship nor pending request exists
- **THEN** only the block row is inserted

#### Scenario: Failure rolls back all writes
- **WHEN** any step of the cascade fails
- **THEN** no friendship deletion, no request termination, and no block row is persisted

### Requirement: Friend-request cleanup paths preserve blocks

The existing friendship/request cleanup paths (`cleanup_on_contact_delete`, `cleanup_on_contact_method_delete`, `delete_own_phone`, `terminate_pending_and_friendship_between`) MUST NOT modify `user_blocks` rows in any direction. Block lifecycle is owned exclusively by `block_user` / `unblock_user`.

#### Scenario: Contact delete leaves block intact
- **WHEN** user A deletes a contact resolving to user B and `user_blocks(A, B)` exists
- **THEN** the `user_blocks` row is unchanged

#### Scenario: Own-phone delete leaves blocks in both directions intact
- **WHEN** user A invokes `delete_own_phone()` and `user_blocks(A, X)` and/or `user_blocks(Y, A)` rows exist
- **THEN** all such `user_blocks` rows are unchanged
