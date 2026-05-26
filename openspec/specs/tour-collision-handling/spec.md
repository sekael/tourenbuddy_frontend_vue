# tour-collision-handling Specification

## Purpose
TBD - created by archiving change friend-tour-visibility. Update Purpose after archive.
## Requirements
### Requirement: Goal collision detection
Two tours SHALL be treated as the same objective when their goal points lie within a 100m radius of each other. Collision distance SHALL be computed with the existing tour distance utility.

#### Scenario: Goals within radius collide
- **WHEN** a new tour's goal is within 100m of an existing visible tour's goal
- **THEN** the two are treated as a collision for prompting and map precedence

#### Scenario: Goals outside radius do not collide
- **WHEN** a new tour's goal is more than 100m from every visible tour's goal
- **THEN** no collision is triggered and the tour saves normally

### Requirement: Duplicate-save prompt for partner friends
When user B creates a tour that collides with a friend's tour on which B is already a marked partner, the system SHALL prompt B to save a duplicate. On confirmation, B's tour SHALL be saved to B's own account with the friend marked as a partner (following the normal shared-tour create flow, including its notification). On decline, B's tour SHALL NOT be saved and the colliding tour's owner SHALL be notified that B is interested.

#### Scenario: B confirms the duplicate
- **WHEN** B is prompted on a colliding tour where B is a partner and confirms
- **THEN** B's tour is saved with the friend marked as partner, and the friend receives the standard shared-tour created notification

#### Scenario: B declines the duplicate
- **WHEN** B is prompted on a colliding tour where B is a partner and declines
- **THEN** B's tour is not saved and the colliding tour's owner receives a `tour_interest` notification

#### Scenario: Collision on a non-partner friend tour does not prompt
- **WHEN** B's new goal collides only with friend tours on which B is not a partner
- **THEN** no duplicate prompt is shown and B's tour saves normally

### Requirement: Tour interest notification
When B declines a duplicate save, the system SHALL notify the colliding tour's owner that B is interested in the tour, via push and email, under the `tour_interest` notification type, honoring the owner's `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types`. The notification Worker SHALL authorize the request by verifying an accepted friendship exists between the caller and the tour owner and that the tour is `friends`-visible; it SHALL NOT re-verify collision or partner status (interest is the decline path). The notification SHALL be sent only to the owner, naming the caller as the interested friend.

#### Scenario: Owner notified of interest
- **WHEN** the interest notification fires and the owner has push and email enabled and has not muted `tour_interest`
- **THEN** the owner receives both a push and an email naming the interested friend and tour

#### Scenario: Owner muted interest type
- **WHEN** the owner has `tour_interest` in `notif_muted_types`
- **THEN** no interest notification is dispatched regardless of channel state

#### Scenario: Non-friend caller rejected
- **WHEN** a caller with no accepted friendship to the tour owner posts an interest request
- **THEN** the Worker rejects it and no notification is sent

### Requirement: Owned-over-friend map precedence
On the map, when an owned tour and a friend tour collide (within 100m), the owned tour SHALL take precedence and the colliding friend marker SHALL be suppressed. The colliding friend tour SHALL still appear in the Friends list tab.

#### Scenario: Owned marker wins on the map
- **WHEN** an owned tour and a partner-friend tour collide
- **THEN** only the owned marker renders on the map and the friend marker is suppressed

#### Scenario: Suppressed friend tour still listed
- **WHEN** a friend tour is suppressed on the map due to collision with an owned tour
- **THEN** that friend tour still appears in the Friends list tab

