## ADDED Requirements

### Requirement: Activities per leg

A tour SHALL optionally say which activities it uses from the start to the goal (way up) and
from the goal to the end (way down). Both legs SHALL be set together, each with at least one
activity, and the tour's activities SHALL be exactly their union. An unsplit tour SHALL use all
its activities both ways.

#### Scenario: Hike & fly

- **WHEN** a tour is saved with hiking up and paragliding down
- **THEN** its activities SHALL be hiking and paragliding, its way up hiking and its way down
  paragliding

#### Scenario: An older app changes the activities

- **WHEN** a client that does not know legs saves a split tour with different activities
- **THEN** the legs SHALL be cleared

#### Scenario: An older app saves the same activities

- **WHEN** a client that does not know legs saves a split tour with unchanged activities
- **THEN** the legs SHALL be kept
