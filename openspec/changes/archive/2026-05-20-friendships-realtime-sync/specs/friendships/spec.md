## ADDED Requirements

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
