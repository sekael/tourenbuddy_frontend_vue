## ADDED Requirements

### Requirement: Tours repository supports update

The `ToursRepository` interface SHALL include an `updateTour(id, draft, goal)` method that accepts a tour ID, a full `TourDraft`, and the goal coordinates. The Supabase implementation SHALL invoke an `update_tour_full` RPC that updates the `tours` row and replaces associated `tour_partners` rows atomically, passing the same parameter shape as `create_tour_full` plus `p_id`.

#### Scenario: Update tour with all fields

- **WHEN** `updateTour` is called with a draft containing values for every field
- **THEN** the repository SHALL call `update_tour_full` with `p_id`, `p_planned_date`, `p_name`, `p_goal`, `p_partner_ids`, `p_tour_type`, `p_elevation`, `p_gpx_track`, `p_description`, `p_seasons`, `p_start_point`, `p_end_point`, `p_equipment`, `p_notes`

#### Scenario: Update tour clearing optional fields

- **WHEN** `updateTour` is called with a draft where optional fields are null
- **THEN** the repository SHALL pass null for each corresponding RPC parameter so the row is cleared

#### Scenario: Update returns error on RPC failure

- **WHEN** the Supabase RPC returns an error
- **THEN** the repository SHALL throw an `Error` carrying the RPC error message

### Requirement: Tours repository supports delete

The `ToursRepository` interface SHALL include a `deleteTour(id)` method that accepts a tour ID. The Supabase implementation SHALL issue a `DELETE` on the `tours` table scoped by `id`; associated `tour_partners` rows SHALL be removed via the database FK cascade.

#### Scenario: Delete tour via repository

- **WHEN** `deleteTour` is called with a valid tour ID owned by the current user
- **THEN** the row is removed from `tours` and all `tour_partners` rows referencing it are cascade-deleted

#### Scenario: Delete returns error on Supabase failure

- **WHEN** the Supabase delete query returns an error
- **THEN** the repository SHALL throw an `Error` carrying the error message

### Requirement: Tours store supports update

The `useToursStore` Pinia store SHALL expose an `updateTour(id, draft, goal)` action that calls the repository and, on success, replaces the matching entry in the local `tours` array without issuing a full reload.

#### Scenario: Store update reflects in list

- **WHEN** `updateTour` completes successfully
- **THEN** the local `tours` array SHALL contain the refreshed tour at its existing position and other entries SHALL be unchanged

#### Scenario: Store update surfaces errors

- **WHEN** the repository throws during update
- **THEN** the store SHALL re-throw the error so the caller can display it and SHALL leave the local `tours` array unchanged

### Requirement: Tours store supports delete

The `useToursStore` Pinia store SHALL expose a `deleteTour(id)` action that calls the repository and, on success, removes the tour from the local `tours` array. The tour SHALL NOT be removed from the local array until the repository confirms deletion.

#### Scenario: Store delete reflects in list

- **WHEN** `deleteTour` completes successfully
- **THEN** the tour is removed from `tours` immediately and other entries SHALL be unchanged

#### Scenario: Store delete surfaces errors

- **WHEN** the repository throws during delete
- **THEN** the store SHALL re-throw the error and SHALL leave the tour in the local `tours` array

### Requirement: Shared tour form component

A shared `TourForm` component SHALL own the full tour field set (name, planned date, tour type, elevation, GPX track, description, seasons, start/end points, equipment, notes, partner selection) with validation and point-picking emits. The tour creation dialog and the tour edit view SHALL both render this component. The form SHALL accept an optional `initialDraft` prop, a `submitLabel` prop, and an `allowGoalEdit` prop, and emit `submit` with a complete `TourDraft`, `cancel`, and `pickPoint` events where `pickPoint` carries `'start' | 'end' | 'goal'`.

#### Scenario: Create flow renders shared form

- **WHEN** the user opens the tour creation dialog
- **THEN** the dialog SHALL render `TourForm` with no `initialDraft`, `allowGoalEdit` set to false, and a submit label of "Create"

#### Scenario: Edit flow renders shared form pre-filled

- **WHEN** the user enters edit mode on an existing tour
- **THEN** `TourForm` SHALL render with `initialDraft` populated from the current tour (including partner IDs, seasons, start/end points, GPX track), `allowGoalEdit` set to true, and a submit label of "Save"

#### Scenario: Submit emits full TourDraft

- **WHEN** the user submits the form
- **THEN** the `submit` event SHALL carry a `TourDraft` containing the current value of every field, with optional fields as `null` when empty

### Requirement: Tour goal editable via location picker

The tour goal SHALL be editable in edit mode via the existing `LocationPicker` overlay. The goal row SHALL NOT expose a free-text coordinate input; the only way to change it SHALL be through the picker. While the picker is open, the info sheet / edit view SHALL be hidden but its in-progress form values SHALL be preserved. On confirm the new coordinates SHALL replace the goal for the edit session; on cancel the original goal SHALL remain unchanged.

#### Scenario: Open location picker from edit mode

- **WHEN** the user taps the "Change goal" action on the goal row in edit mode
- **THEN** the tour info sheet SHALL be hidden and `LocationPicker` SHALL open
- **AND** the picker SHALL start centered on the tour's current goal coordinates

#### Scenario: Confirm new goal

- **WHEN** the user confirms a new location in the picker
- **THEN** the picker SHALL close, the info sheet SHALL re-open in edit mode, the displayed goal row SHALL show the new coordinates, and all other in-progress form values SHALL be preserved

#### Scenario: Cancel goal pick

- **WHEN** the user cancels the picker
- **THEN** the picker SHALL close, the info sheet SHALL re-open in edit mode, and the goal SHALL remain the original value

#### Scenario: Save persists new goal

- **WHEN** the user saves after picking a new goal
- **THEN** `toursStore.updateTour` SHALL be called with the new goal coordinates and the tour's map marker SHALL move to the new position after the store update

### Requirement: Tour info sheet edit entry point

The tour info sheet SHALL include an edit action (Material Symbols `edit` icon) in its header area. Activating it SHALL switch the sheet body from the read-only detail view to the shared tour form pre-filled with the current tour, while keeping the sheet open.

#### Scenario: Enter edit mode from info sheet

- **WHEN** the user taps the edit action on a tour info sheet
- **THEN** the sheet body SHALL replace the detail view with the tour form pre-filled with the current tour's values
- **AND** the sheet SHALL remain open

#### Scenario: Exit edit mode via cancel

- **WHEN** the user cancels the edit form (back or cancel action)
- **THEN** the sheet SHALL return to the read-only detail view with the unchanged tour
- **AND** any edits SHALL be discarded without a confirmation prompt

#### Scenario: Save updated tour

- **WHEN** the user submits a valid edit
- **THEN** the sheet SHALL call `toursStore.updateTour` and, on success, return to the read-only detail view showing the updated values

#### Scenario: Name required on edit

- **WHEN** the user clears the name field and attempts to save
- **THEN** the form SHALL display a validation error and SHALL NOT call `updateTour`

#### Scenario: Update error displayed inline

- **WHEN** `updateTour` throws
- **THEN** the form SHALL display the error message inline and remain in edit mode

### Requirement: Tour info sheet delete action

The tour info sheet SHALL include a delete action. Deletion SHALL require an inline confirmation step before any server call. On successful deletion the sheet SHALL close and the tour SHALL be removed from the map markers.

#### Scenario: Delete tour with confirmation

- **WHEN** the user taps "Delete tour" in the info sheet
- **THEN** an inline confirmation prompt SHALL appear with Cancel and Delete actions
- **WHEN** the user confirms
- **THEN** `toursStore.deleteTour` SHALL be called, and on success the sheet SHALL close

#### Scenario: Cancel deletion

- **WHEN** the user taps "Delete tour" and then taps Cancel
- **THEN** the tour SHALL NOT be deleted and the sheet SHALL remain open on the detail view

#### Scenario: Delete loading state

- **WHEN** the delete request is in flight
- **THEN** the Delete action SHALL show a loading state and further interactions SHALL be disabled

#### Scenario: Delete error handling

- **WHEN** `deleteTour` throws
- **THEN** the sheet SHALL display an inline error message and the tour SHALL remain in the list

## MODIFIED Requirements

### Requirement: Tour info display

A component SHALL display tour details including name, planned date, coordinates, and partner names as chips, as well as all extended fields when present. The component SHALL also expose edit and delete entry points for the currently displayed tour.

#### Scenario: Display tour with partners

- **WHEN** the tour info component is shown for a tour with partners
- **THEN** it SHALL display the tour name (or "Unnamed tour"), formatted date, coordinates, and partner names resolved from the contacts store

#### Scenario: Display tour without partners

- **WHEN** the tour info component is shown for a tour with no partners
- **THEN** it SHALL display the tour details without a partners section

#### Scenario: Round trip detection

- **WHEN** a tour has a start point but null end point, or start and end are equal coordinates
- **THEN** the info sheet SHALL display "Round trip" for the end point row

#### Scenario: Edit and delete actions present

- **WHEN** the tour info sheet is shown
- **THEN** it SHALL display an edit action and a delete action that trigger the edit mode and the delete confirmation flow respectively
