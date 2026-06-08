## ADDED Requirements

### Requirement: Realtime synchronization of user profile state

The system SHALL keep the authenticated user's profile in sync across the user's devices in real time, without a page reload, by subscribing to Supabase Realtime `postgres_changes` on `public.user_profile`, filtered by `id=eq.${currentUserId}`. The filter MUST be on `id` (the primary key, equal to the auth user id) and NOT `user_id` — `user_profile` has no `user_id` column.

#### Scenario: Profile edit on device A reflects on device B
- **WHEN** the user changes a profile field (name, phone, locale, notification setting) on device A while device B is signed in as the same user
- **THEN** device B reflects the change within one debounce window, without a page reload

#### Scenario: Filter is on the id column
- **WHEN** the user-profile store wires its Realtime binding
- **THEN** the binding filter is `id=eq.${currentUserId}` (a `user_id`-based filter is a defect — it matches zero rows)

#### Scenario: Subscription gated on auth
- **WHEN** the user is not authenticated
- **THEN** no Realtime channel for the user profile is open

#### Scenario: Clean teardown on sign-out
- **WHEN** the user signs out
- **THEN** the user-profile Realtime channel is removed and local profile state is cleared

### Requirement: User-profile store uses the shared realtime primitive

The `user-profile-store` MUST NOT call `supabase.channel(...)` / `supabase.removeChannel(...)` directly. It SHALL wire Realtime via `src/core/realtime/use-realtime-subscription.ts`, supplying a channel key `user-profile-${currentUserId}`, a single binding on `user_profile` with `event: '*'` and filter `id=eq.${currentUserId}`, an `onChange` that debounces `loadProfile()`, and an `onSubscribed` that runs `loadProfile()` once after `SUBSCRIBED`.

#### Scenario: Store consumes the primitive
- **WHEN** the user-profile store wires Realtime
- **THEN** it invokes `useRealtimeSubscription` and no direct `supabase.channel` / `supabase.removeChannel` call exists in the store

#### Scenario: Baseline fetch runs after SUBSCRIBED
- **WHEN** the channel reaches `SUBSCRIBED`
- **THEN** the primitive invokes `loadProfile()` exactly once per subscribe cycle

### Requirement: Realtime replication enabled for user_profile

The database SHALL include `public.user_profile` in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, RLS remaining the sole authorization gate.

#### Scenario: Table is a member of supabase_realtime
- **WHEN** the publication is inspected after migrations are applied
- **THEN** `public.user_profile` is a member of `supabase_realtime` and its `relreplident` is `'f'`

#### Scenario: RLS still gates visibility
- **WHEN** an authenticated client subscribes on `user_profile`
- **THEN** it receives only events for its own profile row

### Requirement: Realtime handler MUST NOT dispatch notifications

User-profile Realtime event handlers MUST NOT trigger any notification dispatch. Realtime remains UI-sync only.

#### Scenario: No notification dispatch from Realtime
- **WHEN** any `postgres_changes` event for `user_profile` is received
- **THEN** no notification dispatch function is invoked from the `onChange` handler
