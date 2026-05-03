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

### Requirement: Elevation display

The tour info sheet SHALL display the elevation with the `landscape` Material Symbol icon.

#### Scenario: Elevation present

- **WHEN** the tour has an elevation value
- **THEN** the info sheet SHALL display it formatted as "X'XXX m" (with thousands separator)

#### Scenario: No elevation

- **WHEN** the tour has null elevation
- **THEN** no elevation row SHALL be displayed

### Requirement: Description display with auto-linked URLs

The tour info sheet SHALL display the description text with URLs automatically converted to clickable links.

#### Scenario: Description with URL

- **WHEN** the tour description contains "Check https://example.com for details"
- **THEN** the URL portion SHALL render as a clickable `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"`

#### Scenario: Description without URLs

- **WHEN** the tour description contains only plain text
- **THEN** it SHALL render as plain text

#### Scenario: No description

- **WHEN** the tour has null description
- **THEN** no description section SHALL be displayed

### Requirement: Season tags display

The tour info sheet SHALL display seasons as colored chips/tags.

#### Scenario: Seasons present

- **WHEN** the tour has one or more seasons
- **THEN** they SHALL be displayed as small tag chips (e.g., "Winter", "Spring")

#### Scenario: No seasons

- **WHEN** the tour has null or empty seasons
- **THEN** no season row SHALL be displayed

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

### Requirement: Equipment display

The tour info sheet SHALL display equipment text with the `backpack` Material Symbol icon.

#### Scenario: Equipment present

- **WHEN** the tour has equipment text
- **THEN** it SHALL be displayed as a text block

#### Scenario: No equipment

- **WHEN** equipment is null
- **THEN** no equipment row SHALL be displayed

### Requirement: Notes display

The tour info sheet SHALL display notes text with the `sticky_note_2` Material Symbol icon.

#### Scenario: Notes present

- **WHEN** the tour has notes text
- **THEN** it SHALL be displayed as a text block

#### Scenario: No notes

- **WHEN** notes is null
- **THEN** no notes row SHALL be displayed

### Requirement: GPX track indicator

The tour info sheet SHALL indicate when a GPX track is available.

#### Scenario: GPX track present

- **WHEN** the tour has a GPX track
- **THEN** the info sheet SHALL display a "Track available" indicator with the `route` icon
- **AND** the GPX track SHALL be visible on the map

#### Scenario: No GPX track

- **WHEN** the tour has no GPX track
- **THEN** no track indicator SHALL be displayed

### Requirement: Adaptive info layout

The info sheet SHALL only display sections for fields that have values, maintaining clean spacing.

#### Scenario: Tour with all fields

- **WHEN** all optional fields are populated
- **THEN** all sections SHALL be displayed in logical order with consistent spacing

#### Scenario: Tour with minimal fields

- **WHEN** only name and goal are set (legacy tour)
- **THEN** only name and coordinates SHALL be displayed, with no empty sections or gaps

### Requirement: Completion toggle control

The tour info sheet SHALL display a rounded checkbox-style toggle control in the bottom-right action row, alongside the existing edit and delete buttons. The control SHALL display a green checkmark when the tour is completed and an empty rounded box when not completed. Activation SHALL invoke the tours store `setCompleted` action instantly — no confirmation dialog — for both mark and unmark directions.

#### Scenario: Toggle shown for tour owner

- **WHEN** the info sheet is opened by the tour's owner
- **THEN** the completion toggle control SHALL be visible in the bottom-right action row beside edit and delete
- **AND** its visual state SHALL reflect the tour's current `completed` field (green checkmark if true, empty rounded box if false)

#### Scenario: Toggle hidden or disabled for non-owner

- **WHEN** the info sheet is opened by a user who does not own the tour
- **THEN** the completion toggle control SHALL be hidden or rendered as non-interactive (consistent with how edit and delete are gated for non-owners)

#### Scenario: Mark tour completed from info sheet

- **WHEN** the tour is not completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, true)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the green checkmark state

#### Scenario: Unmark tour from info sheet

- **WHEN** the tour is completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, false)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the empty (not-completed) state

#### Scenario: Failure surfaced to user

- **WHEN** `setCompleted` fails and rolls back
- **THEN** the toggle control SHALL reflect the original state
- **AND** the error SHALL be surfaced via the existing snackbar/error presentation pattern
