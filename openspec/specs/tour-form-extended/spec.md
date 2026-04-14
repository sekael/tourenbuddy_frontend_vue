## ADDED Requirements

### Requirement: Tour type selector

The tour creation dialog SHALL include a tour type selector with all defined activity types, displayed as selectable chips or a dropdown.

#### Scenario: User selects tour type

- **WHEN** the user taps a tour type chip
- **THEN** the selected type SHALL be highlighted and stored in the draft

#### Scenario: No tour type selected

- **WHEN** the user does not select a tour type
- **THEN** the draft `tourType` SHALL be null

### Requirement: Elevation field with auto-fill indicator

The tour creation dialog SHALL display an elevation number input. When auto-filled from Swisstopo, it SHALL show a subtle indicator (e.g., icon or label) that the value was auto-retrieved.

#### Scenario: Auto-filled elevation displayed

- **WHEN** elevation was auto-retrieved
- **THEN** the field SHALL show the value with an auto-fill indicator
- **AND** the user SHALL be able to edit the value

#### Scenario: Manual elevation entry

- **WHEN** no auto-fill is available
- **THEN** the field SHALL be empty with placeholder "Elevation (m)"

### Requirement: Description textarea

The tour creation dialog SHALL include a multi-line textarea for description/guide text.

#### Scenario: User enters description

- **WHEN** the user types text into the description field
- **THEN** the value SHALL be stored in the draft as plain text

### Requirement: Season chip selector

The tour creation dialog SHALL include season chips (Winter, Spring, Summer, Autumn) supporting multi-select.

#### Scenario: Multiple seasons selected

- **WHEN** the user taps Winter and Spring chips
- **THEN** both SHALL be highlighted and `seasons` SHALL contain `['winter', 'spring']`

#### Scenario: Toggle season off

- **WHEN** the user taps an already-selected season chip
- **THEN** it SHALL be deselected and removed from the seasons array

### Requirement: Start and end point pickers

The tour creation dialog SHALL allow optional start and end point selection via map coordinate pickers.

#### Scenario: User sets start point

- **WHEN** the user activates start point picker and confirms a location
- **THEN** the start point coordinates SHALL be stored in the draft and displayed

#### Scenario: User sets end point

- **WHEN** the user activates end point picker and confirms a location
- **THEN** the end point coordinates SHALL be stored in the draft

#### Scenario: No start/end points

- **WHEN** the user does not set start or end points
- **THEN** both SHALL be null in the draft

### Requirement: Equipment textarea

The tour creation dialog SHALL include a multi-line textarea for equipment/gear lists.

#### Scenario: User enters equipment

- **WHEN** the user types equipment text
- **THEN** the value SHALL be stored in the draft

### Requirement: Notes textarea

The tour creation dialog SHALL include a multi-line textarea for miscellaneous notes.

#### Scenario: User enters notes

- **WHEN** the user types notes
- **THEN** the value SHALL be stored in the draft

### Requirement: GPX upload control

The tour creation dialog SHALL include a file upload button for GPX files.

#### Scenario: GPX file selected

- **WHEN** the user selects a GPX file
- **THEN** the filename SHALL be displayed with a remove button
- **AND** a preview indicator SHALL confirm successful parsing

### Requirement: Adaptive form layout

The form SHALL organize fields into logical sections and remain usable regardless of which optional fields the user fills.

#### Scenario: Mobile layout

- **WHEN** the dialog is displayed on mobile (viewport < 600px)
- **THEN** it SHALL render as a full-screen sheet with scrollable content

#### Scenario: Desktop layout

- **WHEN** the dialog is displayed on desktop (viewport >= 600px)
- **THEN** it SHALL render as a centered dialog with scrollable content and max-width 560px

#### Scenario: Minimal fields filled

- **WHEN** the user only fills the tour type and confirms
- **THEN** the form SHALL submit without validation errors on empty optional fields
