## MODIFIED Requirements

### Requirement: Tour creation dialog

A dialog component SHALL allow users to create new tours with a required name, optional planned date, partner selection, activity type, elevation, GPX track, description, seasons, start/end points, equipment, and notes. The dialog SHALL expose a "Change" action on the goal row that reopens the `LocationPicker` to let the user change the tour goal without losing other in-progress form values.

#### Scenario: Create tour with all fields

- **WHEN** the user fills in all fields and submits
- **THEN** the dialog SHALL return a TourDraft object with all selected values

#### Scenario: Tour name is required

- **WHEN** the user submits without entering a tour name
- **THEN** the dialog SHALL show a validation error and prevent submission

#### Scenario: Create tour with minimal fields

- **WHEN** the user submits with only a name filled
- **THEN** the dialog SHALL return a TourDraft with null for all optional fields

#### Scenario: Location picker captures coordinates at visual crosshair center

- **WHEN** the user confirms a location in the location picker
- **THEN** the component SHALL read the geographic coordinates at the pixel center of the map canvas using `map.unproject()`, NOT `map.getCenter()`
- **AND** the coordinates SHALL match the visual position of the crosshair overlay regardless of any active map padding

#### Scenario: Coordinates accurate after viewing tour with padding

- **WHEN** a user has previously viewed a tour (which applies map padding via `flyTo`)
- **AND** then enters location picking mode and confirms a location
- **THEN** the saved coordinates SHALL correspond to the crosshair's visual position, not the padded viewport center

#### Scenario: Start/end point defaulting

- **WHEN** only a start point is set
- **THEN** the effective end point SHALL equal the start point (round trip)
- **WHEN** only an end point is set
- **THEN** the effective start point SHALL equal the end point
- **WHEN** neither point is set
- **THEN** both SHALL be null

#### Scenario: Open goal picker from creation dialog

- **WHEN** the user taps the "Change" action on the goal row while the tour creation dialog is open
- **THEN** the creation overlay SHALL collapse to a header-only state and `LocationPicker` SHALL open
- **AND** the picker SHALL start centered on the currently pending goal coordinates
- **AND** all other in-progress form values (name, date, partners, tour type, elevation, GPX, description, seasons, start/end points, equipment, notes) SHALL be preserved in memory

#### Scenario: Cancel goal change during creation

- **WHEN** the user cancels the location picker opened from the creation dialog
- **THEN** the picker SHALL close, the creation dialog SHALL re-expand, and the pending goal coordinates, suggested name, and elevation SHALL remain unchanged
- **AND** all other in-progress form values SHALL be preserved

#### Scenario: Confirm goal change with same coordinates

- **WHEN** the user confirms the location picker with coordinates within 10 meters (LV95 euclidean distance) of the current pending goal
- **THEN** the picker SHALL close and the creation dialog SHALL re-expand
- **AND** pending goal coordinates, suggested name, and elevation SHALL NOT change
- **AND** no Swisstopo elevation or name lookup SHALL be issued

#### Scenario: Confirm goal change with new coordinates

- **WHEN** the user confirms the location picker with coordinates that differ from the current pending goal by more than 10 meters (LV95 euclidean distance)
- **THEN** the picker SHALL close and the creation dialog SHALL re-expand
- **AND** the pending goal coordinates SHALL update to the new location
- **AND** the Swisstopo elevation and name-suggestion services SHALL be invoked in parallel for the new coordinates
- **AND** the resolved elevation and suggested name SHALL replace the dialog's initial elevation and initial name
- **AND** all other in-progress form values SHALL be preserved

### Requirement: Shared tour form component

A shared `TourForm` component SHALL own the full tour field set (name, planned date, tour type, elevation, GPX track, description, seasons, start/end points, equipment, notes, partner selection) with validation and point-picking emits. The tour creation dialog and the tour edit view SHALL both render this component. The form SHALL accept an optional `initialDraft` prop, a `submitLabel` prop, and an `allowGoalEdit` prop, and emit `submit` with a complete `TourDraft`, `cancel`, and `pickPoint` events where `pickPoint` carries `'start' | 'end' | 'goal'`. The form SHALL reactively overwrite its internal name and elevation values when the `initialName` / `initialElevation` props change to a non-null value after mount, so that an updated goal suggestion propagates into the visible fields without losing other in-progress form values.

#### Scenario: Create flow renders shared form

- **WHEN** the user opens the tour creation dialog
- **THEN** the dialog SHALL render `TourForm` with no `initialDraft`, `allowGoalEdit` set to true, and a submit label of "Create"

#### Scenario: Edit flow renders shared form pre-filled

- **WHEN** the user enters edit mode on an existing tour
- **THEN** `TourForm` SHALL render with `initialDraft` populated from the current tour (including partner IDs, seasons, start/end points, GPX track), `allowGoalEdit` set to true, and a submit label of "Save"

#### Scenario: Submit emits full TourDraft

- **WHEN** the user submits the form
- **THEN** the `submit` event SHALL carry a `TourDraft` containing the current value of every field, with optional fields as `null` when empty

#### Scenario: Updated name suggestion propagates into form

- **WHEN** the parent updates the `initialName` prop to a non-null value after the form has mounted
- **THEN** `TourForm` SHALL update its visible name field to the new value

#### Scenario: Updated elevation propagates into form

- **WHEN** the parent updates the `initialElevation` prop to a non-null value after the form has mounted
- **THEN** `TourForm` SHALL update its visible elevation field to the new value

#### Scenario: Null name suggestion leaves field untouched

- **WHEN** the parent updates the `initialName` prop to `null` after mount
- **THEN** `TourForm` SHALL NOT overwrite the current name field value
