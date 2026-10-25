## MODIFIED Requirements

### Requirement: Link group invariants enforced by triggers
The database SHALL maintain the invariant that all pairs of distinct owners in a `tour_link_group` are mutual accepted friends and that every member tour has `visibility = 'friends'`, shares at least one activity type with every other member, and has its goal within 200 m of every other member. The system SHALL evict any tour that violates the invariant from its group via DB triggers.

#### Scenario: Goal moved outside the radius
- **WHEN** a member tour's goal is updated such that it is more than 200 m from any other member tour's goal
- **THEN** the moved tour is removed from the group

#### Scenario: Tour type changed
- **WHEN** a member tour's activity types are updated so that it no longer shares a type with some other member
- **THEN** the changed tour is removed from the group

#### Scenario: Activity added to a linked tour
- **WHEN** a member tour of type `hiking` linked with another `hiking` tour gains `skitour` as a second type
- **THEN** the tour stays in the group

#### Scenario: Visibility flipped away from friends
- **WHEN** a member tour's `visibility` is changed from `friends` to `private`
- **THEN** the tour is removed from the group

#### Scenario: Friendship between two member owners ends
- **WHEN** the `friendships` row between owners X and Y is deleted (the table is binary; deletion is the only break path) and both have tours in the same group
- **THEN** both X's and Y's tours are removed from that group; tours owned by other still-friends members remain in place

#### Scenario: 3-way group dies on a single friendship break
- **WHEN** {A, B, C} are linked in one group and the A↔B friendship row is deleted
- **THEN** A's and B's tours are both evicted, leaving only C's tour in the group, which then dissolves (count drops below 2)

### Requirement: Tour save fires collision-detected notification
After the owner creates or meaningfully updates a friends-visible tour — whether or not it has partners — the system SHALL, in the same transaction, scan for friend-owned tours satisfying the collision predicate and emit a `tour_interest` notification to each colliding owner. Push/email delivery SHALL be best-effort: failures SHALL NOT block or roll back the tour write.

#### Scenario: New tour collides with a friend tour
- **WHEN** owner A saves a tour whose goal is within 200 m, sharing at least one activity type, and with friends-visibility matching a friend B's tour also at friends-visibility
- **THEN** a `tour_interest` notification naming A as the friend who planned the same tour is emitted for B

#### Scenario: Solo tour without partners
- **WHEN** owner A creates a friends-visible tour with no partners that collides with friend B's tour
- **THEN** a `tour_interest` notification is emitted for B

#### Scenario: Owner muted the type
- **WHEN** B has `tour_interest` in `notif_muted_types`
- **THEN** no push or email is sent to B even though the scan finds the collision; B's inbox still records it

#### Scenario: No collision found
- **WHEN** the saved tour has no friend-owned collisions
- **THEN** no notification is emitted

#### Scenario: Worker dispatch failure does not fail the save
- **WHEN** push/email delivery for the emitted event fails
- **THEN** the tour write still succeeds and the failure is logged server-side

### Requirement: Edit-warning dialog before eviction-causing or pending-request-invalidating edits
The client SHALL display a confirmation dialog before saving an edit that would EITHER (a) cause eviction from a `tour_link_group` — changing the goal beyond the 200 m boundary from any sibling, changing the activity types so that the tour no longer shares one with some sibling, or changing visibility from `friends` to `private` — OR (b) invalidate the collision predicate for any `pending` `tour_link_request` involving the edited tour as initiator or target (goal moved >200 m from the counterpart tour's goal, no activity type left in common, visibility flips away from `friends`). The dialog SHALL follow the same design language as the existing friendship/contact delete dialog and SHALL adapt its title and body copy by mode: (1) `linked` when the tour is grouped → "this tour will be unlinked"; (2) `pending-outgoing` when only the user's own initiated pending request(s) are affected → "your pending link request(s) will be cancelled" (explicit ownership); (3) `pending-incoming` when only requests initiated by other users targeting this tour are affected → "there are outstanding link requests for this tour; applying these changes will withdraw them" (no implication the user sent any request); (4) `pending-mixed` when both directions are affected → reuse the `pending-incoming` copy with the combined count. Cancellation SHALL abort the edit; confirmation SHALL proceed with the edit, the DB trigger SHALL perform the eviction (if grouped), and the DB trigger SHALL set affected pending requests to `withdrawn` (regardless of grouping). Trigger-driven withdrawal SHALL NOT dispatch notifications, mirroring the manual-withdraw policy.

#### Scenario: Goal nudge across the boundary
- **WHEN** A edits a linked tour's goal to a location more than 200 m from a sibling member's goal
- **THEN** the client shows the eviction-warning dialog before submitting the edit

#### Scenario: Type change on a linked tour
- **WHEN** A changes the activity types of a linked tour so that it no longer shares a type with a sibling
- **THEN** the client shows the eviction-warning dialog before submitting

#### Scenario: Visibility flip to private on a linked tour
- **WHEN** A switches a linked tour to private
- **THEN** the client shows the eviction-warning dialog before submitting

#### Scenario: Edit that does not affect linking
- **WHEN** A edits the description of a linked tour
- **THEN** no eviction warning is shown and the edit proceeds normally

#### Scenario: Goal moved >200 m while a pending outgoing request exists (not yet grouped)
- **WHEN** A has an outgoing `pending` `tour_link_request` from A's tour to B's tour, A's tour is not in any group, and A edits the goal to a location more than 200 m from B's tour goal
- **THEN** the client shows the warning dialog with pending-request copy; on confirm, the edit saves and the DB trigger sets the pending request to `withdrawn`
- **AND** if B subsequently attempts to accept, the request is no longer `pending` and the accept UI no longer offers it (preventing `predicate_failed`)

#### Scenario: Tour-type change with pending incoming request
- **WHEN** A has an incoming `pending` request on A's tour from B's tour (A did not initiate any request), and A changes A's tour activity types so that none is left in common with B's tour
- **THEN** the client shows the warning dialog in `pending-incoming` mode with copy framed around "outstanding link requests for this tour" — explicitly NOT implying A sent any request — and on confirm, the edit saves and the DB trigger sets the pending request to `withdrawn`

#### Scenario: Outgoing pending request shows ownership in copy
- **WHEN** A has an outgoing `pending` request from A's tour to B's tour and A's edit would break the predicate
- **THEN** the warning dialog renders in `pending-outgoing` mode with copy that explicitly names the request as A's own ("your pending link request(s) you sent")

#### Scenario: Mixed incoming and outgoing pending
- **WHEN** A's tour is both initiator of one pending request and target of another, and A's edit would break both
- **THEN** the dialog renders in `pending-mixed` mode using the incoming-style copy with the combined count (avoids overclaiming ownership)

#### Scenario: Trigger-driven auto-withdrawal is silent
- **WHEN** the DB trigger sets a pending request to `withdrawn` because an edit broke the collision predicate
- **THEN** no notification is dispatched to either side (matching the manual-withdraw policy)

