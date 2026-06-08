## ADDED Requirements

### Requirement: Realtime delivery of friend tour changes

The system SHALL deliver friend-tour create / edit / delete / visibility-flip to authorized viewers in real time, so the Friends list, friend map markers, and the collision/tour-link disclaimer update without a page reload. Because friend visibility (accepted friendship AND `visibility='friends'`, with per-viewer partner detail gating) cannot be expressed as a `postgres_changes` row filter, delivery SHALL use a server-side trigger that routes a signal to a per-viewer private broadcast topic.

#### Scenario: Friend-visible tour created appears for authorized viewer
- **WHEN** owner A creates a tour with `visibility='friends'` and B is A's accepted friend
- **THEN** B's `friendTours` (and the Friends tab + friend map markers) update within one debounce window, without a reload

#### Scenario: Collision disclaimer appears in realtime
- **WHEN** A and B (accepted friends) add tours that collide (same goal + activity)
- **THEN** B's `collision-notice.vue` "request to link" disclaimer appears in realtime, driven by the broadcast-triggered `loadFriendTours()` + tour-links refetch (the #198 motivating bug)

#### Scenario: Friend-visible tour deleted disappears for viewer
- **WHEN** A deletes a `visibility='friends'` tour
- **THEN** B receives a broadcast (computed from the OLD row's audience) and the tour is removed from B's friend collections

#### Scenario: Friends→private flip removes the tour for viewers
- **WHEN** A changes a tour from `visibility='friends'` to a non-friends visibility
- **THEN** A's accepted friends (the OLD audience) are notified, refetch `friend_tours_view`, and the now-private tour drops out — closing the documented "friends→private UPDATE not delivered" gap

#### Scenario: Hidden-tab gap reconciled on resume
- **WHEN** a viewer's tab was hidden (broadcast channel paused) while a friend edited a shared tour
- **THEN** on resume the `onSubscribed` callback refetches friend tours, reconciling any missed broadcast

#### Scenario: Newly accepted friend's tours appear immediately
- **WHEN** a friendship is accepted while the viewer is signed in (no `tours` write occurs)
- **THEN** the viewer's `tours-store` watch on `friendshipsStore.friendUserIds` fires `loadFriendTours()`, and the new friend's `friends`-visible tours (and tours where the viewer is a partner) appear on the Friends tab + map without a reload

#### Scenario: Unfriended user's tours drop immediately
- **WHEN** a friendship is removed
- **THEN** the same `friendUserIds` watch refetches and the ex-friend's tours disappear from the viewer's friend collections

### Requirement: Friend-tour broadcast carries no unauthorized data

The friend-tour broadcast SHALL be signal-only: it MUST NOT carry tour detail fields. Viewers SHALL obtain tour data by refetching through `friend_tours_view` and the friend-tour RPCs, so Layer-1 row visibility and Layer-2 non-partner detail gating (`planned_date` / `gpx_filepath` / partner names) are enforced by RLS on every datum. The mechanism MUST NOT leak the existence or detail of a tour the viewer is not authorized to read.

#### Scenario: Non-partner detail stays gated after a broadcast
- **WHEN** a non-partner friend receives a broadcast and refetches
- **THEN** `planned_date`, `gpx_filepath`, and raw partner identities remain nulled/reduced exactly as `friend_tours_view` already enforces

#### Scenario: Private tour never broadcasts
- **WHEN** owner A writes a tour whose visibility is and was not `friends` (e.g. private→private)
- **THEN** no friend-tour broadcast is emitted, and no viewer learns the tour exists

#### Scenario: Harmless poke to an unauthorized recipient
- **WHEN** a viewer receives a broadcast but is (by a race) no longer authorized to read the tour
- **THEN** the refetch through `friend_tours_view` returns nothing for that tour and no unauthorized data is exposed

### Requirement: Friend-tour broadcast audience is the owner's accepted friends

The trigger on `public.tours` SHALL compute the broadcast audience as the owner's accepted friends (from `public.friendships`, both directions) and emit a `refetch` signal to topic `friend-tours:<friendUserId>` for each, whenever the tour is or was `visibility='friends'`. Partner gating SHALL NOT be applied to the audience (it affects detail, not row existence, and is enforced by the view on refetch).

#### Scenario: Each accepted friend is notified, non-friends are not
- **WHEN** A writes a `visibility='friends'` tour with accepted friends B and C and non-friend D
- **THEN** exactly B and C receive a poke on their own topics; D receives nothing

#### Scenario: Audience for delete/flip uses the OLD row
- **WHEN** the change is a DELETE or a friends→private UPDATE
- **THEN** the audience is derived from the OLD row so viewers who could previously see the tour are notified to drop it

### Requirement: Per-viewer topic authorization on realtime.messages

Friend-tour topics SHALL be private broadcast channels named `friend-tours:<userId>`. An RLS policy on `realtime.messages` SHALL permit a session to receive on `friend-tours:<userId>` only when `auth.uid()` equals that `<userId>`. No user may subscribe to another user's friend-tour topic.

#### Scenario: Foreign topic delivers nothing
- **WHEN** a session for user X subscribes to `friend-tours:<Y>` (Y ≠ X)
- **THEN** it receives no messages

#### Scenario: Own topic delivers the poke
- **WHEN** a session for user X subscribes to `friend-tours:<X>` and an authorized friend-tour change occurs
- **THEN** it receives the `refetch` broadcast

### Requirement: Friend-tour realtime uses a shared broadcast primitive

Friend-tour realtime MUST be wired through a shared `src/core/realtime/use-realtime-broadcast.ts` primitive — features MUST NOT call `supabase.channel(...)` directly. The primitive SHALL key channels by topic with module-level refcount dedupe, pause channels while the page is hidden (battery), reuse the singleton `TOKEN_REFRESHED` `setAuth` handler, debounce `onMessage`, and run `onSubscribed` after every (re-)subscribe so a full friend-tour refetch closes any missed-broadcast gap.

#### Scenario: Store consumes the primitive
- **WHEN** `tours-store` wires friend-tour realtime
- **THEN** it invokes `use-realtime-broadcast` on topic `friend-tours:${currentUserId}` and no direct `supabase.channel` call exists in the feature

#### Scenario: Handler drives only loadFriendTours
- **WHEN** the channel reaches `SUBSCRIBED`, or a `refetch` broadcast arrives
- **THEN** `loadFriendTours()` runs (debounced for the message path) and the handler does NOT call tour-links `fetchAll()` directly — tour-links reconciles via its existing `watch(friendTours)`

#### Scenario: Redundant tour-links piggyback removed
- **WHEN** a `tour_link_*` realtime event is handled in `tour-links-store`
- **THEN** it no longer calls `toursStore.loadFriendTours()` (that push now belongs to the friend-tour broadcast / friend-set watch)

### Requirement: Friend-tour broadcast handler MUST NOT dispatch notifications

The friend-tour broadcast handler MUST NOT trigger any notification dispatch (push or email). Realtime remains UI-sync only; `tour_updates` fanout stays in the Worker.

#### Scenario: No notification dispatch from the broadcast handler
- **WHEN** a friend-tour `refetch` broadcast is received
- **THEN** no notification dispatch function is invoked from the handler
