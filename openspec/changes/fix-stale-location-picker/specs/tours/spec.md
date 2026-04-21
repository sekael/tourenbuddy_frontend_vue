## MODIFIED Requirements

### Requirement: Tour goal editable via location picker

The tour goal SHALL be editable in edit mode via the existing `LocationPicker` overlay. The goal row SHALL NOT expose a free-text coordinate input; the only way to change it SHALL be through the picker. While the picker is open, the tour info sheet SHALL be suspended in a collapsed header-only state showing "Edit: <tour title>" with all form inputs and non-picker buttons disabled, but its in-progress form values SHALL be preserved. On confirm the new coordinates SHALL replace the goal for the edit session; on cancel the original goal SHALL remain unchanged. The same suspension behavior SHALL apply when picking start or end points from the edit form.

#### Scenario: Open location picker from edit mode

- **WHEN** the user taps the "Change goal" action on the goal row in edit mode
- **THEN** the tour info sheet SHALL collapse to a title-only header and `LocationPicker` SHALL open
- **AND** the picker SHALL start centered on the tour's current goal coordinates

#### Scenario: Open start point picker from edit mode

- **WHEN** the user taps the "Pick" or "Change" action on the start point row in edit mode
- **THEN** the tour info sheet SHALL collapse to a title-only header and `LocationPicker` SHALL open targeting the start point
- **AND** the picker SHALL start centered on the tour's current start point if one exists, otherwise on a sensible default

#### Scenario: Open end point picker from edit mode

- **WHEN** the user taps the "Pick" or "Change" action on the end point row in edit mode
- **THEN** the tour info sheet SHALL collapse to a title-only header and `LocationPicker` SHALL open targeting the end point
- **AND** the picker SHALL start centered on the tour's current end point if one exists, otherwise on a sensible default

#### Scenario: Form disabled while picking

- **WHEN** the location picker is active during tour edit
- **THEN** all `TourForm` inputs and non-picker action buttons SHALL be disabled
- **AND** the tour info sheet SHALL NOT expose a close button
- **AND** clicking the map background, the backdrop, or pressing Escape SHALL NOT dismiss the sheet

#### Scenario: Submit guarded while picking

- **WHEN** the location picker is active
- **AND** a submit is attempted on the tour edit form (for example via keyboard Enter)
- **THEN** `toursStore.updateTour` SHALL NOT be called
- **AND** the picker SHALL remain active

#### Scenario: Confirm new goal

- **WHEN** the user confirms a new location in the goal picker
- **THEN** the picker SHALL close, the info sheet SHALL re-expand in edit mode, the displayed goal row SHALL show the new coordinates, and all other in-progress form values SHALL be preserved

#### Scenario: Confirm new start or end point

- **WHEN** the user confirms a new location in the start or end point picker
- **THEN** the picker SHALL close, the info sheet SHALL re-expand in edit mode, the targeted row SHALL show the new coordinates, and all other in-progress form values SHALL be preserved

#### Scenario: Cancel goal pick

- **WHEN** the user cancels the picker
- **THEN** the picker SHALL close, the info sheet SHALL re-expand in edit mode, and the target field SHALL remain the original value

#### Scenario: Save persists new goal

- **WHEN** the user saves after picking a new goal
- **THEN** `toursStore.updateTour` SHALL be called with the new goal coordinates and the tour's map marker SHALL move to the new position after the store update
