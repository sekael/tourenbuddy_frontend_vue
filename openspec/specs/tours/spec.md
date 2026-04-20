## ADDED Requirements

### Requirement: Tour model with Zod validation

A Zod schema SHALL define the tour shape: `id` (string), `userId` (string), `plannedDate` (date, nullable), `goal` (object with `lng` and `lat` as numbers), `name` (string, nullable), `partnerIds` (array of strings), `tourType` (tour type enum, nullable), `elevation` (number, nullable), `gpxTrack` (GeoJSON FeatureCollection, nullable), `description` (string, nullable), `seasons` (array of season enum, nullable), `startPoint` (object with `lng` and `lat`, nullable), `endPoint` (object with `lng` and `lat`, nullable), `equipment` (string, nullable), `notes` (string, nullable).

#### Scenario: Valid tour from Supabase tours_view

- **WHEN** a tour row is fetched from the `tours_view`
- **THEN** the Zod schema SHALL parse it into a typed `Tour` object, converting snake_case columns to camelCase properties, `lon`/`lat` to `goal` object, and `start_lon`/`start_lat`/`end_lon`/`end_lat` to point objects

#### Scenario: Legacy tour without new fields

- **WHEN** a tour row has null values for all new columns
- **THEN** the schema SHALL parse it successfully with all new fields as null

#### Scenario: Tour to GeoJSON conversion

- **WHEN** a tour needs to be rendered on the map
- **THEN** the tour SHALL be convertible to a GeoJSON Feature with Point geometry at `[goal.lng, goal.lat]`

### Requirement: Tours repository

A repository SHALL provide methods to create tours with all fields and list tours for the current user.

#### Scenario: Create tour with all fields

- **WHEN** `createTourWithPartners` is called with a draft containing new fields
- **THEN** the repository SHALL pass all fields to the Supabase RPC including `p_tour_type`, `p_elevation`, `p_gpx_track`, `p_description`, `p_seasons`, `p_start_point`, `p_end_point`, `p_equipment`, `p_notes`

#### Scenario: Create tour with only legacy fields

- **WHEN** `createTourWithPartners` is called with new fields as null
- **THEN** the repository SHALL pass null for all new parameters (backward compatible)

#### Scenario: List tours for user

- **WHEN** `listToursForUser(userId)` is called
- **THEN** the repository SHALL SELECT from `tours_view` where `user_id` matches and return parsed Tour objects including all new fields

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

### Requirement: Tours store

A Pinia store (`useToursStore`) SHALL manage the list of tours with reactive `tours`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the tours store SHALL automatically fetch all tours for the current user

#### Scenario: Create tour from draft

- **WHEN** `createTourFromDraft(draft, location)` is called with an extended TourDraft and a LatLng location
- **THEN** the store SHALL generate a UUID, create the tour via the repository with all fields, refresh the tours list, and return the new tour id

#### Scenario: Create tour from draft without authenticated user

- **WHEN** `createTourFromDraft(draft, location)` is called while no user is authenticated
- **THEN** the store SHALL return `null` and SHALL NOT call the repository

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the tours store SHALL clear its cached tours list

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

### Requirement: Tour creation dialog

A dialog component SHALL allow users to create new tours with a required name, optional planned date, partner selection, activity type, elevation, GPX track, description, seasons, start/end points, equipment, and notes.

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

### Requirement: Tour creation dialog styling

The tour creation dialog SHALL use updated design tokens: `--color-surface` background, `--shadow-lg` layered shadow, 16px border-radius, and `--color-outline-variant` border. Input fields SHALL use the updated input styling conventions. The save button SHALL use primary button styling and cancel SHALL use secondary styling.

#### Scenario: Tour creation dialog renders with modern design

- **WHEN** user opens the tour creation dialog
- **THEN** the dialog displays with blueish-grey palette, layered shadow, and modern input/button styles

### Requirement: Tour info sheet design

The tour info sheet SHALL include a drag handle indicator at the top (small centered rounded bar). Detail rows SHALL use Material Symbols icons: `calendar_today` for date, `location_on` for coordinates, `group` for partners. The close button SHALL use Material Symbols `close` icon. The sheet SHALL have `--shadow-lg` and a subtle top border.

#### Scenario: Tour info sheet displays Material Symbols

- **WHEN** user views a tour info sheet
- **THEN** detail rows show Material Symbols icons instead of emoji

#### Scenario: Tour info sheet has drag handle

- **WHEN** the tour info sheet is visible
- **THEN** a small rounded drag handle bar is visible at the top of the sheet

### Requirement: Tour info display

A component SHALL display tour details including name, planned date, coordinates, and partner names as chips, as well as all extended fields when present. The component SHALL also expose edit and delete entry points for the currently displayed tour. Partner chips SHALL be rendered in action mode (clicking opens the contact action menu — see `contact-chip-actions`) and SHALL NOT render inline phone action icons. When the tour has more than one partner, a group messaging row SHALL appear beneath the chips (see `tour-group-messaging`).

#### Scenario: Display tour with partners

- **WHEN** the tour info component is shown for a tour with partners
- **THEN** it SHALL display the tour name (or "Unnamed tour"), formatted date, coordinates, and partner names resolved from the contacts store
- **AND** the partner chips SHALL open the contact action menu on click
- **AND** the partner chips SHALL NOT render inline call or WhatsApp icons

#### Scenario: Display tour with multiple partners

- **WHEN** the tour info component is shown for a tour with two or more partners
- **THEN** a group messaging row SHALL be rendered beneath the partner chips

#### Scenario: Display tour without partners

- **WHEN** the tour info component is shown for a tour with no partners
- **THEN** it SHALL display the tour details without a partners section
- **AND** it SHALL NOT render a group messaging row

#### Scenario: Round trip detection

- **WHEN** a tour has a start point but null end point, or start and end are equal coordinates
- **THEN** the info sheet SHALL display "Round trip" for the end point row

#### Scenario: Edit and delete actions present

- **WHEN** the tour info sheet is shown
- **THEN** it SHALL display an edit action and a delete action that trigger the edit mode and the delete confirmation flow respectively

### Requirement: Tours store reconciles cached partnerIds on contact deletion

The `useToursStore` Pinia store SHALL keep its cached `Tour.partnerIds` consistent with the contacts store. When the contacts store completes a successful `deleteContact` action, the tours store SHALL remove the deleted contact's id from `partnerIds` of every cached tour. The reconciliation SHALL be in-memory only (no repository call) and SHALL preserve all other tour fields and the order of remaining `partnerIds`.

#### Scenario: Deleted contact id removed from cached tours

- **WHEN** the contacts store's `deleteContact(contactId)` action completes successfully
- **AND** one or more cached tours include `contactId` in their `partnerIds`
- **THEN** the tours store SHALL emit a new `tours` array where `contactId` has been removed from every affected tour's `partnerIds`
- **AND** all other tour fields SHALL remain unchanged
- **AND** the relative order of remaining `partnerIds` SHALL be preserved

#### Scenario: No-op when deleted contact is not referenced

- **WHEN** the contacts store's `deleteContact(contactId)` action completes successfully
- **AND** no cached tour has `contactId` in its `partnerIds`
- **THEN** the tours store SHALL NOT mutate any cached tour

#### Scenario: Failed contact deletion leaves cache untouched

- **WHEN** the contacts store's `deleteContact(contactId)` action throws
- **THEN** the tours store SHALL NOT modify any cached tour's `partnerIds`

#### Scenario: Subsequent tour update sends reconciled partnerIds

- **WHEN** a contact has been deleted and removed from cached tours via the reconciliation
- **AND** the user saves an edit to one of those tours without changing the partner selection
- **THEN** the `update_tour_full` RPC call SHALL receive `p_partner_ids` without the deleted contact id

### Requirement: Tour partner details resolved live from contacts store

Tour-feature views and components SHALL resolve partner details (display name, phones, primary phone, contact methods) live from `useContactsStore.contacts` by joining on `Tour.partnerIds`. Tour entities and tour-feature state SHALL NOT cache snapshots of `Contact` fields. As a consequence, any successful mutation in the contacts store — `updateContact`, `addMethodToContact`, `updateMethodOnContact`, `setPrimaryPhoneOnContact`, `removeMethodFromContact` — SHALL be reflected in any open tour view that references the affected contact, on the next reactivity tick, without any explicit reconciliation by the tours feature.

#### Scenario: Contact rename reflected in partner chip

- **WHEN** a contact assigned as a tour partner is renamed via `contactsStore.updateContact`
- **AND** the tour info sheet for that tour is open
- **THEN** the partner chip SHALL display the new name on the next reactivity tick

#### Scenario: Primary phone change reflected in call action

- **WHEN** the primary phone of a contact assigned as a tour partner is changed via `contactsStore.setPrimaryPhoneOnContact` (or via `addMethodToContact`/`updateMethodOnContact` setting `isPrimary: true`)
- **AND** the user opens the contact action menu from the partner chip in the tour info sheet
- **THEN** the call and messaging actions SHALL target the new primary phone

#### Scenario: Removed contact method no longer offered as action

- **WHEN** a phone contact method on a contact assigned as a tour partner is removed via `contactsStore.removeMethodFromContact`
- **AND** the user opens the contact action menu from the partner chip in the tour info sheet
- **THEN** the removed method SHALL NOT appear among the offered actions

#### Scenario: Tour entity does not snapshot contact fields

- **WHEN** the `Tour` Zod schema and entity definitions are inspected
- **THEN** they SHALL contain only `partnerIds` (an array of contact ids) and SHALL NOT contain partner names, phones, or other denormalized contact fields

### Requirement: Auto-open info sheet after tour creation

After a new tour is successfully saved from the creation dialog, the map page SHALL select the newly created tour so that the tour info sheet opens and the map flies to its goal location.

#### Scenario: Info sheet opens for new tour

- **WHEN** the user saves a new tour from the tour creation dialog
- **AND** the store returns a non-null tour id
- **THEN** the map page SHALL set the selected tour id to that new id
- **AND** the tour info sheet SHALL be shown for the new tour
- **AND** the map SHALL fly to the new tour's goal location using the existing `flyToSelectedTour` behavior

#### Scenario: Save fails silently when unauthenticated

- **WHEN** the store returns `null` from `createTourFromDraft`
- **THEN** the map page SHALL NOT change the selected tour id
- **AND** no info sheet SHALL be opened
