## ADDED Requirements

### Requirement: Friendship requires both parties to retain the linking verified phone

A `friendships(A, B)` row is only valid while BOTH parties satisfy all of:
- each party has a verified phone in `auth.users` (`phone_confirmed_at IS NOT NULL`);
- each party has the other in their `contacts` via a `contact_methods` row of `method_type = 'phone'` whose value resolves to the other party's verified phone.

When any of these conditions ceases to hold due to an actor's action (deleting a contact, deleting the linking phone `contact_method`, or deleting their own verified phone), the system MUST remove the `friendships` row.

#### Scenario: Friendship deleted when contact removed
- **WHEN** user A deletes a contact whose phone resolves to user B, and a `friendships(A, B)` row exists
- **THEN** that `friendships` row is deleted in the same transaction as the contact delete

#### Scenario: Friendship deleted when linking phone removed
- **WHEN** user A deletes a phone `contact_method` whose value resolves to user B, and a `friendships(A, B)` row exists
- **THEN** that `friendships` row is deleted in the same transaction as the contact_method delete

#### Scenario: Friendships deleted when user removes own verified phone
- **WHEN** user A invokes `delete_own_phone()` and `friendships` rows exist with A as `request_user_id` or `response_user_id`
- **THEN** all such `friendships` rows are deleted in the same transaction

### Requirement: Pending friend_requests terminated at every break-point

For each of the three break-points (contact delete, linking-phone delete, own-phone delete), the system MUST terminate pending `friend_requests` between the actor and every affected peer:
- Row with `from_user_id = actor` → `status = 'cancelled'`, `responded_at = now()`.
- Row with `to_user_id = actor` → `status = 'denied'`, `responded_at = now()`.
- Rows with `status` other than `'pending'` MUST NOT be modified.

#### Scenario: Outgoing pending cancelled when contact deleted
- **WHEN** user A deletes a contact whose phone resolves to user B and a pending row exists with `from_user_id = A, to_user_id = B`
- **THEN** the row's status becomes `'cancelled'` with `responded_at` set, in the same transaction

#### Scenario: Incoming pending denied when contact deleted
- **WHEN** user A deletes a contact whose phone resolves to user B and a pending row exists with `from_user_id = B, to_user_id = A`
- **THEN** the row's status becomes `'denied'` with `responded_at` set, in the same transaction

#### Scenario: Pending request terminated when linking phone removed
- **WHEN** user A deletes a phone `contact_method` whose value resolves to user B and a pending row exists between A and B
- **THEN** the pending row is terminated using the cancelled/denied rule based on direction

#### Scenario: All caller-side pending requests terminated on own-phone delete
- **WHEN** user A invokes `delete_own_phone()` and pending `friend_requests` rows exist with A as `from_user_id` or `to_user_id`
- **THEN** every such row is terminated (cancelled if A was sender, denied if A was recipient)

#### Scenario: Non-pending requests untouched
- **WHEN** any break-point fires and a `friend_requests` row between the actor and peer has `status` in `{accepted, denied, cancelled}`
- **THEN** that row is not modified by the cleanup logic

### Requirement: Re-establishing the link allows new friend requests

After automatic termination, the partial unique index on pending pairs MUST NOT block re-sending a new friend request between the same two users once the actor restores the link (re-adds the contact, re-adds the phone, or re-verifies their own phone).

#### Scenario: Re-adding contact allows new pending request
- **WHEN** a pending row was auto-cancelled by contact deletion, then the actor re-adds the contact and triggers a new friend request to the same user
- **THEN** insertion of the new pending row succeeds (terminal-status rows do not collide with the pending-only unique index)

### Requirement: Realtime synchronization of friend request state

The system SHALL update the in-app state of `friend_requests` for the current user in real time, without requiring a page reload, by subscribing to Supabase Realtime `postgres_changes` on the `public.friend_requests` table filtered to the authenticated user.

#### Scenario: Incoming friend request appears live
- **WHEN** user A sends a friend request to user B and user B has the app open
- **THEN** the new request appears in user B's incoming list and any notification badge updates without a page reload

#### Scenario: Outgoing request status update appears live
- **WHEN** user B accepts, denies, or the request is cancelled, and user A has the app open
- **THEN** user A's outgoing-request UI reflects the new status without a page reload

#### Scenario: Subscription gated on auth + phone verification
- **WHEN** the user is not authenticated, or has no verified phone
- **THEN** no Realtime channel for friend requests is open

#### Scenario: Clean teardown on sign-out
- **WHEN** the user signs out, or their verified phone is removed
- **THEN** the Realtime channel is removed via `supabase.removeChannel` and no further events are processed

### Requirement: Realtime synchronization of friendships state

The system SHALL update the in-app `friendships` state for the current user in real time by subscribing to Supabase Realtime `postgres_changes` on `public.friendships` filtered to the authenticated user as either `request_user_id` or `response_user_id`.

#### Scenario: Friendship row insert appears live
- **WHEN** an `INSERT` on `friendships` arrives for the current user
- **THEN** the friendship is reflected in `friendUserIds` and dependent UI (e.g., contact friendship icon) within one debounce window

#### Scenario: Friendship icon disappears when other party breaks the link
- **WHEN** the other party deletes their contact (or linking phone) and the existing DB cleanup trigger deletes the corresponding `friendships` row
- **THEN** the current user receives the DELETE event and the friendship icon is removed from their contact list without a page reload

### Requirement: Realtime subscription uses the shared core primitive

Feature stores MUST NOT call `supabase.channel(...)` or `supabase.removeChannel(...)` directly. All Realtime subscriptions SHALL go through `src/core/realtime/use-realtime-subscription.ts`, which centralizes channel lifecycle, auth-gated enable/disable, debounced refetch, and per-key deduplication so additional features (e.g. `tours`) can adopt Realtime by supplying only bindings + a refetch callback.

#### Scenario: Friendships store consumes the primitive
- **WHEN** the friendships store wires Realtime
- **THEN** it invokes `useRealtimeSubscription` with bindings for `friend_requests` and `friendships`; no direct `supabase.channel` call exists in the store

#### Scenario: Primitive tears down channel when enabled flips false
- **WHEN** a consumer's `enabled` ref flips from true to false
- **THEN** the primitive calls `supabase.removeChannel` for the previously created channel and no further events are delivered to the consumer

#### Scenario: Baseline fetch runs only after channel is SUBSCRIBED
- **WHEN** a consumer provides `onSubscribed` and the channel reaches `SUBSCRIBED` status
- **THEN** the primitive invokes `onSubscribed` exactly once per subscribe cycle, after bindings are attached, so no DB write between baseline and stream is lost

#### Scenario: Primitive deduplicates by key
- **WHEN** two consumers request a subscription with the same `key` while both are enabled
- **THEN** only one channel is created and both observe the same lifecycle

#### Scenario: Channel torn down when caller's effect scope disposes
- **WHEN** the caller's owning effect scope ends (Pinia store `$dispose`, HMR module replacement, or parent component unmount) while the subscription is active
- **THEN** the primitive calls `supabase.removeChannel` and clears its registry entry, even if `enabled` never flipped to false

### Requirement: Sign-out is scoped to the current device

`authStore.signOut()` SHALL invoke Supabase auth with `scope: 'local'` so that signing out in any tab clears the session for that browser profile on that device only. Other devices and other PWA installs (each holding their own refresh token in their own storage) MUST remain signed in.

#### Scenario: Sign-out propagates across sibling tabs on the same device
- **WHEN** the user signs out in Tab A
- **THEN** Tab B (same browser profile, same device) receives a `SIGNED_OUT` event via storage-sync and its `isAuthenticated` flips to false, tearing down its Realtime channel

#### Scenario: Sign-out does not affect other devices
- **WHEN** the user signs out on Device A
- **THEN** Device B's refresh token is not revoked server-side, and Device B remains signed in until its own user-initiated sign-out or natural token expiry

### Requirement: Realtime channel auth tracks token refresh

The realtime primitive SHALL listen for `TOKEN_REFRESHED` events from `supabase.auth.onAuthStateChange` and explicitly call `supabase.realtime.setAuth(session.access_token)` so active channels do not drift onto a stale JWT.

#### Scenario: Token refresh updates active channel auth
- **WHEN** `onAuthStateChange` fires with event `TOKEN_REFRESHED`
- **THEN** the primitive calls `supabase.realtime.setAuth` with the new access token

### Requirement: Optimistic writes reconcile cleanly with Realtime echoes

When the store performs an optimistic write and a Realtime event for the same row arrives before or after the RPC response, the user MUST NOT see a duplicate row, nor a wiped optimistic placeholder while the RPC is still in flight.

#### Scenario: Realtime echo arrives before RPC return
- **WHEN** `sendRequest` is called and a Realtime INSERT for the resulting row triggers a refetch before the RPC promise resolves
- **THEN** the refetch's reconcile pass drops the temp placeholder whose `(fromUserId, toUserId)` matches the server row and renders only the server row; no duplicate appears

#### Scenario: RPC returns before Realtime echo
- **WHEN** `sendRequest`'s RPC resolves first and a Realtime INSERT then triggers a refetch
- **THEN** the success path's dedupe-by-id integration prevents the refetch from inserting a second copy of the same row

#### Scenario: In-flight optimistic placeholder survives a mid-flight refetch
- **WHEN** a refetch fires while an optimistic temp row exists whose `(fromUserId, toUserId)` is not yet present on the server
- **THEN** the reconcile pass preserves that optimistic temp row so the user does not see their just-clicked action disappear

### Requirement: Strict separation of push and Realtime concerns

The system MUST keep push / email and Realtime as two independent pathways:
- Realtime event handlers MUST NOT trigger any notification dispatch (push or email).
- The service worker `push` and `notificationclick` handlers MUST NOT mutate in-app store state nor trigger Realtime / store refetches; they MAY only display the OS notification and focus/navigate a client.

Notification dispatch remains driven exclusively by explicit, intent-bound store actions (`sendRequest`, `accept`, `deny`). UI updates remain driven exclusively by Realtime + store actions in the active tab.

#### Scenario: Realtime event does not double-dispatch notifications
- **WHEN** a `friend_requests` INSERT event is received by any client
- **THEN** no call is made to `notifyFriendRequestReceived` or `notifyFriendRequestResponded` from the Realtime handler

#### Scenario: Existing notification pathways remain intact
- **WHEN** a user sends, accepts, or denies a friend request through the store
- **THEN** the corresponding `notifyFriendRequest*` dispatch fires exactly once, as it does today, regardless of whether Realtime is connected

#### Scenario: Service worker never mutates store state
- **WHEN** the service worker receives a `push` event or handles a `notificationclick`
- **THEN** it calls only `showNotification` / `clients.matchAll` / `focus` / `navigate` / `openWindow`; it does not `postMessage` payloads that callers interpret as store mutations and does not perform any DB fetches

### Requirement: Realtime replication enabled for friendship tables

The database SHALL include `public.friend_requests` and `public.friendships` in the `supabase_realtime` publication so that authenticated clients can receive `postgres_changes` events, with RLS policies remaining the sole authorization gate (no policy widening). Both tables SHALL have `REPLICA IDENTITY FULL` so that DELETE and UPDATE event payloads carry every column, allowing server-side filters on non-PK columns (e.g. `friend_requests.to_user_id`) to match reliably under all event types.

#### Scenario: Tables are members of supabase_realtime
- **WHEN** the publication is inspected after migrations are applied
- **THEN** both `public.friend_requests` and `public.friendships` are members of `supabase_realtime`

#### Scenario: Replica identity is FULL on both tables
- **WHEN** `pg_class.relreplident` is inspected for either table
- **THEN** the value is `'f'` (FULL)

#### Scenario: RLS still gates visibility
- **WHEN** an authenticated client subscribes to `postgres_changes` on these tables
- **THEN** they receive only events for rows their existing SELECT RLS policies already permit

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

#### Scenario: Client hides affordance when caller has blocked target
- **WHEN** user A's client evaluates a send-request affordance toward user B and `B ∈ user-blocks-store.blockedUserIds`
- **THEN** the affordance is not rendered (sending a friend request to someone the caller has blocked is suppressed reactively, immediately after the block confirmation)

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
