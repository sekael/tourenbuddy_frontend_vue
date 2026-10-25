## MODIFIED Requirements

### Requirement: New segment form is seeded from the previous segment

A new segment's form SHALL be seeded from the outing's last segment: same activity types,
partners, visibility and seasons; planned date = the day after that segment's last day (a new
stage starts after a night); start point = its end point, else its goal, with name and elevation.
An undated previous segment SHALL leave the date empty.

#### Scenario: Seeded from the previous segment

- **WHEN** the previous segment ends at "Cabane de Bertol" (2311 m) on 12 March with types ski tour
- **THEN** the new segment's form SHALL open with start "Cabane de Bertol", 2311 m, planned date
  13 March and type ski tour

#### Scenario: Previous segment spans days

- **WHEN** the previous segment runs from 12 to 14 March
- **THEN** the new segment SHALL be dated 15 March

## ADDED Requirements

### Requirement: Close a gap between stages

Where a stage starts away from the previous stage's finish, the owner SHALL be offered
"Connect", which makes the previous stage end at the next stage's start point (name and height
included). The gap SHALL disappear once both are saved. Friends SHALL only see the gap.

#### Scenario: Sleeping at the hut

- **WHEN** stage 1 ends on the Sustenhorn summit and stage 2 starts at the Tierberglihütte, and the owner taps "Connect"
- **THEN** stage 1's end point SHALL become the Tierberglihütte and the timeline SHALL show the night there

### Requirement: When to add a stage

The add-stage view SHALL state the rule: one day with one party is one tour, however many
summits; a night starts a new stage. The tour form SHALL say the same below the end date when the
dates span more than one day.

#### Scenario: A multi-day span

- **WHEN** the user sets 12 March to 14 March in the form
- **THEN** a hint below the end date SHALL suggest planning each day as a stage after saving
