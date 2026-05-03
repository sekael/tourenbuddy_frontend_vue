## ADDED Requirements

### Requirement: Start and end point metadata display

When a tour has a name and/or elevation associated with its start or end point, the info sheet SHALL display them alongside the coordinate row for that point.

#### Scenario: Start point with name and elevation

- **WHEN** the tour has `startPoint`, `startPointName`, and `startPointElevation`
- **THEN** the start point row SHALL display the name and elevation in addition to coordinates

#### Scenario: End point with name only

- **WHEN** the tour has `endPoint` and `endPointName` but null `endPointElevation`
- **THEN** the end point row SHALL display the name and coordinates without an elevation value

#### Scenario: Point with coordinates only

- **WHEN** a start or end point has null name and null elevation
- **THEN** the row SHALL display only the coordinates (existing behavior preserved)

## MODIFIED Requirements

### Requirement: Start/end point display

The tour info sheet SHALL display start and end points with route icons. When the start point is set without an end point, the sheet SHALL indicate a one-way tour to the goal rather than a round trip.

#### Scenario: Start and end points set

- **WHEN** the tour has both start and end points
- **THEN** they SHALL be displayed as two coordinate rows with `trip_origin` and `flag` icons

#### Scenario: Only start point (one-way to goal)

- **WHEN** the tour has a start point but null end point
- **THEN** the start point SHALL be displayed with a "One-way to goal" indicator

#### Scenario: No start/end points

- **WHEN** both start and end points are null
- **THEN** no start/end point rows SHALL be displayed
