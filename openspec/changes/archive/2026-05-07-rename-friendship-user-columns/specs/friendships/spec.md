## MODIFIED Requirements

### Requirement: Friendship data model

The system SHALL persist friendships and friend requests in two Supabase tables:

- `friend_requests(id uuid pk, from_user_id uuid fk auth.users, to_user_id uuid fk auth.users, status text check in ('pending','accepted','denied','cancelled'), created_at timestamptz, responded_at timestamptz)` with a unique partial index on `(from_user_id, to_user_id) WHERE status = 'pending'`.
- `friendships(request_user_id uuid, response_user_id uuid, created_at timestamptz, request_id uuid fk friend_requests, primary key (request_user_id, response_user_id))` where `request_user_id` is the user that sent the originating friend request and `response_user_id` is the user that accepted it. The check `request_user_id <> response_user_id` SHALL hold.

Friendships SHALL be symmetric in meaning (both users are friends) and SHALL NOT be duplicated per pair: at most one `friendships` row SHALL exist for any unordered `{u1, u2}` pair, regardless of role assignment.

#### Scenario: Pending request uniqueness

- **WHEN** a `pending` `friend_request` from user A to user B exists and a second insert for the same `(from, to, pending)` is attempted
- **THEN** the database SHALL reject the insert via the unique partial index

#### Scenario: Friendship row reflects request roles

- **WHEN** an accept of a `friend_request` from X to Y succeeds
- **THEN** the inserted `friendships` row SHALL have `request_user_id = X` and `response_user_id = Y`

#### Scenario: No duplicate per unordered pair

- **WHEN** a `friendships` row already exists for users X and Y in either role assignment and a second insert is attempted for the same pair (in either ordering)
- **THEN** the database SHALL NOT create a duplicate row

### Requirement: Friendships list visibility

A user SHALL be able to read `friendships` rows where they appear as `request_user_id` or `response_user_id`, and SHALL NOT be able to read any other friendship row. A user SHALL NOT have client-side INSERT/UPDATE/DELETE on `friendships`.

#### Scenario: User reads own friendships

- **WHEN** a user queries `friendships`
- **THEN** the response SHALL contain only rows where the user is `request_user_id` or `response_user_id`

#### Scenario: Direct write rejected

- **WHEN** a user attempts to INSERT, UPDATE, or DELETE on `friendships` directly
- **THEN** RLS SHALL reject the operation

### Requirement: Accept friend request

A SECURITY DEFINER function `accept_friend_request(request_id uuid)` SHALL, in a single transaction:

1. Verify the calling user equals the request's `to_user_id` and the request status is `pending`
2. Update the request to `status = 'accepted'`, `responded_at = now()`
3. Insert a row into `friendships` with `request_user_id = from_user_id` and `response_user_id = to_user_id` (no-op if a row for the unordered pair already exists)

If the friendship already exists, the function SHALL still mark the request `accepted` and SHALL NOT raise.

#### Scenario: Successful accept

- **WHEN** the recipient calls `accept_friend_request(req)` on a pending request from X to Y addressed to them
- **THEN** the request status SHALL become `accepted`, `responded_at` SHALL be set, and a `friendships` row SHALL exist with `request_user_id = X`, `response_user_id = Y`

#### Scenario: Caller is not recipient

- **WHEN** a user other than `to_user_id` calls `accept_friend_request`
- **THEN** the function SHALL raise an authorization error and SHALL NOT modify any row

#### Scenario: Request already responded

- **WHEN** `accept_friend_request` is called on a request with status `denied`, `cancelled`, or `accepted`
- **THEN** the function SHALL leave the request unchanged (idempotent for `accepted`; error for `denied`/`cancelled`)

### Requirement: Remove friendship

A SECURITY DEFINER function `remove_friendship(p_other_user_id uuid)` SHALL delete the `friendships` row for the unordered caller–other pair, regardless of which user is `request_user_id` vs `response_user_id`. If no row exists the function SHALL be a no-op.

A `removeFriendship(otherUserId)` action in `useFriendshipsStore` SHALL call the RPC, optimistically remove the friendship from the `friendships` ref, and rollback on error.

#### Scenario: Friendship removed by requester

- **WHEN** `remove_friendship` is called by the user stored as `request_user_id` of the pair
- **THEN** the `friendships` row SHALL be deleted

#### Scenario: Friendship removed by responder

- **WHEN** `remove_friendship` is called by the user stored as `response_user_id` of the pair
- **THEN** the `friendships` row SHALL be deleted

#### Scenario: Non-participant cannot remove

- **WHEN** a user calls `remove_friendship` for a pair they are not part of
- **THEN** no row SHALL be deleted (function computes match using `auth.uid()`)
