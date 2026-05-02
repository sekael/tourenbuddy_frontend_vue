## ADDED Requirements

### Requirement: Pick-type label in collapsed overlay header

While the location picker is active, the surrounding tour creation dialog and tour info sheet collapse to a header-only surface (bottom sheet on mobile, side-drawer compact header on desktop). That collapsed header SHALL display a label naming the location type currently being picked, so the user retains context once the form is hidden.

The label SHALL resolve from the active pick type:

- `goal` → "Tour Goal" / "Tourenziel"
- `start` → "Start Point" / "Startpunkt"
- `end` → "End Point" / "Endpunkt"

The `location-picker.vue` component itself SHALL NOT render an additional title bar over the map canvas.

#### Scenario: Goal pick on mobile

- **WHEN** the user is on a mobile viewport and enters location-pick mode with pick type `goal`
- **THEN** the bottom sheet SHALL be collapsed to its header row and the title SHALL read "Tour Goal" (or its localized equivalent)

#### Scenario: Start pick on desktop

- **WHEN** the user is on a desktop viewport and enters location-pick mode with pick type `start`
- **THEN** the side drawer SHALL be in its collapsed top-right header state and the title SHALL read "Start Point" (or its localized equivalent)

#### Scenario: End pick label

- **WHEN** the user enters location-pick mode with pick type `end` on either viewport
- **THEN** the collapsed overlay header SHALL read "End Point" (or its localized equivalent)

#### Scenario: No standalone title bar on map canvas

- **WHEN** location-pick mode is active for any pick type
- **THEN** `location-picker.vue` SHALL NOT render a title bar over the map; the only label SHALL be the one in the collapsed overlay header

### Requirement: Start and end point metadata auto-fetch

When the user confirms a start or end point pick, the system SHALL fetch elevation and a name suggestion from Swisstopo in parallel and pass the results to the tour form.

#### Scenario: Start point pick auto-fills metadata

- **WHEN** the user confirms a `start` location pick
- **THEN** the system SHALL call the elevation service and name-suggestion service for the picked coordinates and store the results as the start point's name and elevation in the draft

#### Scenario: End point pick auto-fills metadata

- **WHEN** the user confirms an `end` location pick
- **THEN** the system SHALL call the elevation service and name-suggestion service for the picked coordinates and store the results as the end point's name and elevation in the draft

#### Scenario: Service failure leaves metadata null

- **WHEN** elevation or name suggestion fails for a start or end pick
- **THEN** the corresponding metadata field SHALL be null and the coordinate SHALL still be stored

### Requirement: Start and end point rows display metadata

When a start or end point has an associated name and/or elevation, the tour form row for that point SHALL display them alongside the coordinates.

#### Scenario: Start point with name and elevation

- **WHEN** the form renders a start point that has both `startPointName` and `startPointElevation`
- **THEN** the row SHALL show the name and elevation in addition to the coordinates

#### Scenario: Start point with coordinates only

- **WHEN** the form renders a start point with null name and null elevation
- **THEN** the row SHALL show only the coordinates

## MODIFIED Requirements

### Requirement: Start and end point pickers

The tour creation dialog SHALL allow optional start and end point selection via map coordinate pickers. By default the form SHALL render the start point row only; the end point row SHALL be revealed by an explicit "Add end point" affordance. Picking the start point SHALL NOT auto-fill the end point, and picking the end point SHALL NOT auto-fill the start point.

#### Scenario: Initial form shows start row only

- **WHEN** the form opens with no draft start or end point
- **THEN** only the start point row SHALL be visible, plus an "Add end point" button

#### Scenario: User adds end point row

- **WHEN** the user taps "Add end point"
- **THEN** the end point row SHALL be revealed with a pick button

#### Scenario: User sets start point

- **WHEN** the user activates start point picker and confirms a location
- **THEN** the start point coordinates SHALL be stored in the draft and displayed; the end point SHALL remain unchanged

#### Scenario: User sets end point

- **WHEN** the user activates end point picker and confirms a location
- **THEN** the end point coordinates SHALL be stored in the draft; the start point SHALL remain unchanged

#### Scenario: User removes end point

- **WHEN** the user clears a previously set end point
- **THEN** `endPoint`, `endPointName`, and `endPointElevation` SHALL be null in the draft and the row SHALL collapse back to the "Add end point" affordance

#### Scenario: No start/end points

- **WHEN** the user does not set start or end points
- **THEN** both SHALL be null in the draft, representing a one-way tour from an unspecified start to the goal
