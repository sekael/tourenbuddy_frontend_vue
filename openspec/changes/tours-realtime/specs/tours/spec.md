## ADDED Requirements

### Requirement: Realtime synchronization of tour list state

The system SHALL keep the in-app tours list of the authenticated user in sync across the user's devices in real time, without requiring a page reload, by subscribing to Supabase Realtime `postgres_changes` on `public.tours` and `public.tour_attachments`, each filtered to the authenticated user via `user_id=eq.${currentUserId}`. `public.tour_partners` is intentionally excluded: every in-app partner-set change is preceded by an UPDATE/INSERT/DELETE on the parent `tours` row, so the `tours` subscription captures it transitively.

#### Scenario: Tour created on device A appears on device B
- **WHEN** user creates a tour on device A while device B has the app open and is signed in as the same user
- **THEN** device B's tours list reflects the new tour within one debounce window, without a page reload

#### Scenario: Tour updated on device A reflects on device B
- **WHEN** user edits any field of a tour on device A (including planned date, partner ids, attachments)
- **THEN** device B's tours list and any open tour info sheet reflect the change within one debounce window

#### Scenario: Tour deleted on device A disappears on device B
- **WHEN** user deletes a tour on device A
- **THEN** device B receives the DELETE event and removes the tour from its local list

#### Scenario: Map cluster tree recomputes on remote add / delete / goal change
- **WHEN** a remote create, delete, or goal-location update arrives via realtime and the debounced `loadTours()` reassigns the `tours` ref
- **THEN** the map marker layer's cluster tree is rebuilt (the `[tours, selectedTourId]` watcher in `tourenbuddy-map.vue` fires and calls `markerLayer.updateTours(...)`) within one debounce window

#### Scenario: Tour list reassignment is the contract
- **WHEN** any tour-mutation code path (action or realtime refetch) updates the in-memory tour list
- **THEN** it SHALL replace `tours.value` with a new array reference rather than mutating items in place, so the cluster watcher fires reliably

#### Scenario: Subscription gated on auth
- **WHEN** the user is not authenticated
- **THEN** no Realtime channel for tours is open

#### Scenario: Clean teardown on sign-out
- **WHEN** the user signs out
- **THEN** the tours Realtime channel is removed and the local tours list is cleared

### Requirement: Tours store uses the shared realtime primitive

The `tours-store` MUST NOT call `supabase.channel(...)` or `supabase.removeChannel(...)` directly. It SHALL wire Realtime via `src/core/realtime/use-realtime-subscription.ts`, supplying:
- a channel key of the form `tours-${currentUserId}` so per-user channels deduplicate,
- a single binding on `tours` with `event: '*'` and filter `user_id=eq.${currentUserId}`,
- an `onChange` callback that debounces a full `loadTours()` refetch,
- an `onSubscribed` callback that runs `loadTours()` once after `SUBSCRIBED`, so no write between baseline and stream is lost.

The `tour-attachments-store` SHALL wire a separate subscription via the same primitive with channel key `tour-attachments-${currentUserId}`, a single binding on `tour_attachments` with `event: '*'` and filter `user_id=eq.${currentUserId}`. The `onChange` handler SHALL refetch attachments only for the currently loaded tour and short-circuit if none is active.

#### Scenario: Store consumes the primitive
- **WHEN** the tours store wires Realtime
- **THEN** it invokes `useRealtimeSubscription` and no direct `supabase.channel` or `supabase.removeChannel` call exists in the store

#### Scenario: Per-user channel key dedupes within a session
- **WHEN** the store is reinstantiated (HMR, navigation between pages that both consume it) while the user is signed in
- **THEN** only one tours channel exists per `currentUserId` at any time

#### Scenario: Baseline fetch runs after SUBSCRIBED
- **WHEN** the channel reaches `SUBSCRIBED`
- **THEN** the primitive invokes `loadTours()` exactly once per subscribe cycle, after bindings are attached

### Requirement: Realtime echoes do not produce duplicates with optimistic writes

The tours store's local writes (create / update / delete) MAY arrive at the Realtime stream as echoes after the corresponding mutation already updated local state. The refetch path MUST converge to a single row per tour id regardless of arrival order of the RPC response and the Realtime echo.

#### Scenario: Echo arrives before RPC returns
- **WHEN** a create/update RPC is in flight and a Realtime event for the same tour triggers a debounced refetch first
- **THEN** the refetch result replaces the local list deterministically and the user sees exactly one row for the tour

#### Scenario: RPC returns before echo
- **WHEN** the RPC returns first and applies local state, then a Realtime echo triggers a refetch
- **THEN** the refetch result still yields exactly one row per tour id (no duplicate)

### Requirement: Realtime handler MUST NOT dispatch notifications

Tour Realtime event handlers MUST NOT trigger any notification dispatch (push or email). Realtime remains a UI-sync pathway only; any notification dispatch for tours, if introduced later, MUST live exclusively in explicit store actions.

#### Scenario: No notification dispatch from Realtime
- **WHEN** any `postgres_changes` event for `tours` / `tour_attachments` is received
- **THEN** no notification dispatch function is invoked from the `onChange` handler

### Requirement: Realtime replication enabled for tour-related tables

The database SHALL include `public.tours` and `public.tour_attachments` in the `supabase_realtime` publication, with RLS remaining the sole authorization gate (no policy widening). Both tables SHALL have `REPLICA IDENTITY FULL` so DELETE and UPDATE payloads carry every column, allowing server-side filters on `user_id` to match reliably under all event types. `public.tour_partners` is NOT added to the publication — partner-set changes are observed transitively via the parent `tours` UPDATE event.

#### Scenario: Tables are members of supabase_realtime
- **WHEN** the publication is inspected after migrations are applied
- **THEN** `public.tours` and `public.tour_attachments` are members of `supabase_realtime`, and `public.tour_partners` is NOT

#### Scenario: Replica identity is FULL on both tables
- **WHEN** `pg_class.relreplident` is inspected for either table
- **THEN** the value is `'f'` (FULL)

#### Scenario: RLS still gates visibility
- **WHEN** an authenticated client subscribes to `postgres_changes` on either table
- **THEN** the client receives only events for rows its existing SELECT RLS policies already permit
