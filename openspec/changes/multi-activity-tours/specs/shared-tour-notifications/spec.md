## MODIFIED Requirements

### Requirement: Collision scan after tour save
When a tour save qualifies for the collision scan, the system SHALL find friend-owned tours satisfying the shared collision predicate (within 200 m, at least one activity type in common, both friends-visible, mutual accepted friendship) and emit a `tour_interest` notification to each colliding owner, in the same transaction as the save. The scan SHALL only run for saves by the tour's owner. Failures SHALL NOT block or roll back the tour write.

#### Scenario: Save with friend-owned colliding tour
- **WHEN** A saves a tour and a friend B owns a tour that matches the collision predicate
- **THEN** a `tour_interest` notification naming A and identifying the colliding tour is emitted for B

#### Scenario: Save with no collisions
- **WHEN** A saves a tour and no friend-owned tour matches the predicate
- **THEN** no `tour_interest` notification is emitted

#### Scenario: Invalid caller
- **WHEN** a user who does not own the tour attempts to save it
- **THEN** the write is rejected and no scan runs

