## ADDED Requirements

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

### Requirement: Verified-phone gating on request creation

A `friend_request` INSERT SHALL be rejected unless BOTH the calling user (`from_user_id = auth.uid()`) and the target user have `phone_confirmed_at IS NOT NULL` on their `auth.users` row. RLS policy SHALL enforce this server-side, independent of any client check.

#### Scenario: Caller phone unverified

- **WHEN** a user without `phone_confirmed_at` attempts to insert a `friend_request`
- **THEN** the insert SHALL be rejected by RLS

#### Scenario: Target phone unverified

- **WHEN** a verified user attempts to insert a `friend_request` whose `to_user_id` does not have `phone_confirmed_at`
- **THEN** the insert SHALL be rejected by RLS

#### Scenario: Both verified

- **WHEN** both caller and target have `phone_confirmed_at` set and the caller submits a request
- **THEN** the row SHALL be inserted with status `pending`

### Requirement: Verified-phone discovery RPC

A SECURITY DEFINER function `find_user_by_phone(phone text) RETURNS uuid` SHALL look up `auth.users` for an entry with the exact E.164-normalized `phone` value AND `phone_confirmed_at IS NOT NULL`, returning the matched `user_id` or `null`. The function SHALL return `null` (without lookup) when the calling user does not have `phone_confirmed_at` set. A batch variant `find_users_by_phones(phones text[]) RETURNS table(phone text, user_id uuid)` SHALL exist for the import flow and apply the same caller-gating.

#### Scenario: Caller unverified

- **WHEN** an unverified caller invokes `find_user_by_phone('+41791234567')`
- **THEN** the function SHALL return `null` regardless of whether the phone matches a real verified user

#### Scenario: Verified caller, no match

- **WHEN** a verified caller invokes `find_user_by_phone(p)` and no `auth.users` row has `phone = p AND phone_confirmed_at IS NOT NULL`
- **THEN** the function SHALL return `null`

#### Scenario: Verified caller, match

- **WHEN** a verified caller invokes `find_user_by_phone(p)` and exactly one `auth.users` row matches with verified phone
- **THEN** the function SHALL return that row's `user_id`

#### Scenario: Caller's own phone is filtered

- **WHEN** a verified caller invokes `find_user_by_phone` with their own phone number
- **THEN** the function SHALL return `null`

#### Scenario: Batch lookup respects gating

- **WHEN** an unverified caller invokes `find_users_by_phones(['+411','+412'])`
- **THEN** the function SHALL return zero rows

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

### Requirement: Deny friend request

The recipient SHALL be able to deny a pending request by updating its status to `denied`. RLS SHALL allow UPDATE only when `auth.uid() = to_user_id` AND the new status is `denied` AND the previous status was `pending`. Denying SHALL NOT create a `friendships` row.

#### Scenario: Recipient denies

- **WHEN** the recipient updates their pending request to `denied`
- **THEN** the request row SHALL have `status = 'denied'`, `responded_at` set, and no `friendships` row SHALL exist

#### Scenario: Non-recipient cannot deny

- **WHEN** a user other than `to_user_id` attempts to update status to `denied`
- **THEN** the update SHALL be rejected by RLS

### Requirement: Cancel outgoing request

The sender SHALL be able to cancel their own pending request by updating its status to `cancelled`. RLS SHALL allow UPDATE only when `auth.uid() = from_user_id` AND the previous status was `pending` AND the new status is `cancelled`.

#### Scenario: Sender cancels pending

- **WHEN** the sender of a pending request sets its status to `cancelled`
- **THEN** the row SHALL have `status = 'cancelled'` and SHALL NOT be selectable as pending in the recipient's inbox

### Requirement: Friendships list visibility

A user SHALL be able to read `friendships` rows where they appear as `request_user_id` or `response_user_id`, and SHALL NOT be able to read any other friendship row. A user SHALL NOT have client-side INSERT/UPDATE/DELETE on `friendships`.

#### Scenario: User reads own friendships

- **WHEN** a user queries `friendships`
- **THEN** the response SHALL contain only rows where the user is `request_user_id` or `response_user_id`

#### Scenario: Direct write rejected

- **WHEN** a user attempts to INSERT, UPDATE, or DELETE on `friendships` directly
- **THEN** RLS SHALL reject the operation

### Requirement: Friendships store

A Pinia store `useFriendshipsStore` SHALL manage:

- `incomingRequests`, `outgoingRequests`, `friendships` reactive lists
- `isLoading`, `error` state
- Actions: `fetchAll()`, `sendRequest(targetUserId)`, `accept(requestId)`, `deny(requestId)`, `cancel(requestId)`, `findUserByPhone(phone)`, `findUsersByPhones(phones)`
- A getter `friendUserIds` returning a `Set<string>` of friend user IDs for fast lookup

The store SHALL fetch on auth-store transition to authenticated and SHALL clear on sign-out.

#### Scenario: Auto-fetch on auth

- **WHEN** the auth store transitions to authenticated AND the user's phone is verified
- **THEN** the friendships store SHALL fetch incoming, outgoing, and accepted lists

#### Scenario: Skip fetch when unverified

- **WHEN** the auth store transitions to authenticated AND the user's phone is NOT verified
- **THEN** the friendships store SHALL NOT call discovery or list endpoints, and SHALL keep all lists empty

#### Scenario: Send request optimistic update

- **WHEN** `sendRequest(targetUserId)` succeeds
- **THEN** the store SHALL append the new pending request to `outgoingRequests`

#### Scenario: Accept moves request to friendship

- **WHEN** `accept(requestId)` succeeds
- **THEN** the store SHALL remove the request from `incomingRequests` and add the corresponding friend user ID to `friendships`/`friendUserIds`

### Requirement: Auto-create contact on friendship acceptance

When a user accepts an incoming friend request, the system SHALL check whether any existing contact already has the requesting user's E.164 phone number as a contact method. If no such contact exists, the system SHALL automatically create a new contact with the phone number (formatted for display) as the first name and the E.164 value as a primary phone contact method. The check and creation SHALL be performed client-side immediately after a successful `accept` call, using the phone resolved from `userIdToPhoneMap`. If the phone cannot be resolved (e.g. not yet in the map), no contact SHALL be created. The user SHALL be informed via a transient notification (snackbar) when a contact is auto-created.

#### Scenario: No existing contact — contact auto-created

- **WHEN** a user accepts a friend request and no existing contact has the requester's phone
- **THEN** a new contact SHALL be created with the requester's formatted phone as first name and E.164 phone as a primary phone method, and a snackbar SHALL inform the user

#### Scenario: Existing contact — no duplicate created

- **WHEN** a user accepts a friend request and an existing contact already holds the requester's phone
- **THEN** no new contact SHALL be created and no snackbar about contact creation SHALL appear

#### Scenario: Phone not in map — no contact created

- **WHEN** a user accepts a friend request but the requester's phone cannot be resolved from `userIdToPhoneMap`
- **THEN** the accept SHALL succeed normally and no contact creation SHALL be attempted

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the friendships store SHALL clear all reactive lists

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

### Requirement: Friend requests inbox page

A page (e.g. `/friends/requests`) SHALL render two sections: incoming pending requests with Accept and Deny actions, and outgoing pending requests with a Cancel action. Each row SHALL display the requester/recipient identity (name where available, otherwise opaque user reference) and the request creation time.

#### Scenario: Incoming request actions

- **WHEN** the page renders an incoming pending request and the user taps Accept
- **THEN** the store's `accept(requestId)` action SHALL be called and the row SHALL be removed on success

#### Scenario: Outgoing cancel

- **WHEN** the user taps Cancel on an outgoing pending request
- **THEN** the store's `cancel(requestId)` action SHALL be called and the row SHALL be removed on success

#### Scenario: Empty state

- **WHEN** the user has no incoming and no outgoing pending requests
- **THEN** the page SHALL show an empty-state message with i18n copy
