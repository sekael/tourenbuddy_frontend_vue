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

### Requirement: Tours store

A Pinia store (`useToursStore`) SHALL manage the list of tours with reactive `tours`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the tours store SHALL automatically fetch all tours for the current user

#### Scenario: Create tour from draft

- **WHEN** `createTourFromDraft(draft, location)` is called with an extended TourDraft and a LatLng location
- **THEN** the store SHALL generate a UUID, create the tour via the repository with all fields, and refresh the tours list

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the tours store SHALL clear its cached tours list

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

### Requirement: Tour info display

A component SHALL display tour details including name, planned date, coordinates, and partner names as chips, as well as all extended fields when present.

#### Scenario: Display tour with partners

- **WHEN** the tour info component is shown for a tour with partners
- **THEN** it SHALL display the tour name (or "Unnamed tour"), formatted date, coordinates, and partner names resolved from the contacts store

#### Scenario: Display tour without partners

- **WHEN** the tour info component is shown for a tour with no partners
- **THEN** it SHALL display the tour details without a partners section

#### Scenario: Round trip detection

- **WHEN** a tour has a start point but null end point, or start and end are equal coordinates
- **THEN** the info sheet SHALL display "Round trip" for the end point row

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
