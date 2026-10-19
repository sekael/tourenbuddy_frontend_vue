## MODIFIED Requirements

### Requirement: Start and end point metadata auto-fetch

When the user confirms a start or end point pick, the tour form SHALL set the point at once and look up its name and elevation from Swisstopo, each field on its own, with the same loading, failure and typed-value rules as the goal's name and elevation fields.

#### Scenario: Start point pick auto-fills metadata

- **WHEN** the user confirms a `start` location pick
- **THEN** the form SHALL call the elevation service and name-suggestion service for the picked coordinates and fill the start point's name and elevation fields as each answers

#### Scenario: End point pick auto-fills metadata

- **WHEN** the user confirms an `end` location pick
- **THEN** the form SHALL call the elevation service and name-suggestion service for the picked coordinates and fill the end point's name and elevation fields as each answers

#### Scenario: Service failure leaves metadata null

- **WHEN** elevation or name suggestion fails for a start or end pick
- **THEN** the corresponding field SHALL stay empty with the manual-entry placeholder, the draft value SHALL be null, and the coordinate SHALL still be stored

#### Scenario: Removing a point stops its lookups

- **WHEN** the user removes a start or end point while its lookups are running
- **THEN** the requests SHALL be aborted and no late answer SHALL be saved with the draft
