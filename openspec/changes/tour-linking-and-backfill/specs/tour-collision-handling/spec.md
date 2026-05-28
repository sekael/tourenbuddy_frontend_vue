## MODIFIED Requirements

### Requirement: Goal collision detection
Two tours SHALL be treated as the same objective when ALL of the following hold: their goal points lie within a 100 m radius of each other; both have a non-null `tour_type` and the values are equal; both have `visibility = 'friends'`; and their owners are mutual accepted friends. Collision distance SHALL be computed with the existing tour distance utility. This predicate SHALL be the single source of truth used by both the client (info-sheet collision notice, map precedence, link suggestions) and the notification Worker (post-save scan, friendship-accept backfill scan).

#### Scenario: All conditions met
- **WHEN** A's tour and B's tour are within 100 m, share the same non-null `tour_type`, are both friends-visible, and A and B are accepted friends
- **THEN** the two are treated as a collision for notices, map precedence, and link suggestions

#### Scenario: Different tour type
- **WHEN** A's and B's tours are within 100 m and friends-visible but have different `tour_type` values
- **THEN** no collision is triggered

#### Scenario: Null tour type
- **WHEN** A's or B's tour has a null `tour_type`
- **THEN** no collision is triggered (null types do not match anything, including each other)

#### Scenario: One side private
- **WHEN** A's tour is friends-visible but B's tour is private (or vice versa)
- **THEN** no collision is triggered

#### Scenario: Owners not friends
- **WHEN** A's and B's tours satisfy the geometric and visibility conditions but A and B are not accepted friends
- **THEN** no collision is triggered

#### Scenario: Goals outside radius
- **WHEN** a new tour's goal is more than 100 m from every otherwise-matching tour's goal
- **THEN** no collision is triggered and the tour saves normally

## REMOVED Requirements

### Requirement: Duplicate-save prompt for partner friends
**Reason:** The "duplicate save vs. signal interest" branch is replaced by a non-blocking save flow plus opt-in link requests. Tours always save freely; the social signal becomes a server-fired `tour_interest` notification on collision and a durable, two-sided link handshake.
**Migration:** Remove `duplicate-tour-dialog.vue` and the pending-duplicate / decline-→-signal-interest branch in `map-page.vue`. Saves proceed unconditionally. The collision-detected notification is dispatched from the Worker as part of `tour-linking` and `shared-tour-notifications` (see those capabilities).

### Requirement: Tour interest notification
**Reason:** The `tour_interest` notification is no longer triggered by declining a duplicate save; it is now triggered by the Worker's post-save collision scan and by link-request lifecycle events. The new requirements live under `tour-linking` (collision-detected notification, link-request notification, friendship-accept digest) and `shared-tour-notifications` (Worker endpoint repurposing).
**Migration:** The Worker endpoint `/notify/tour-interest` is repurposed (see `shared-tour-notifications` MODIFIED requirements). The Brevo templates and the `'tour_interest'` enum value SHALL be retained end-to-end. Only the templates' wording and the in-app preference label change; the dispatch trigger moves from "decline" to "Worker scan after save" and link-request lifecycle events.
