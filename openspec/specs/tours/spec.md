## ADDED Requirements

### Requirement: Tour model with Zod validation

A Zod schema SHALL define the tour shape: `id` (string), `userId` (string), `plannedDate` (date, nullable), `goal` (object with `lng` and `lat` as numbers), `name` (string, nullable), `partnerIds` (array of strings).

#### Scenario: Valid tour from Supabase tours_view

- **WHEN** a tour row is fetched from the `tours_view`
- **THEN** the Zod schema SHALL parse it into a typed `Tour` object, converting `lon`/`lat` columns to a `goal` object

#### Scenario: Tour to GeoJSON conversion

- **WHEN** a tour needs to be rendered on the map
- **THEN** the tour SHALL be convertible to a GeoJSON Feature with Point geometry at `[goal.lng, goal.lat]`

### Requirement: Tours repository

A repository SHALL provide methods to create tours and list tours for the current user.

#### Scenario: Create tour with partners

- **WHEN** `createTour(tour, partnerIds)` is called
- **THEN** the repository SHALL call the Supabase RPC function `create_tour_with_partners` with parameters `p_id`, `p_planned_date`, `p_name`, `p_goal` (PostGIS point), and `p_partner_ids`

#### Scenario: List tours for user

- **WHEN** `listToursForUser(userId)` is called
- **THEN** the repository SHALL SELECT from `tours_view` where `user_id` matches and return parsed Tour objects

### Requirement: Tours store

A Pinia store (`useToursStore`) SHALL manage the list of tours with reactive `tours`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the tours store SHALL automatically fetch all tours for the current user

#### Scenario: Create tour from draft

- **WHEN** `createTourFromDraft(draft, location)` is called with a TourDraft (name, plannedDate, partnerIds) and a LatLng location
- **THEN** the store SHALL generate a UUID, create the tour via the repository, and refresh the tours list

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the tours store SHALL clear its cached tours list

### Requirement: Tour creation dialog

A dialog component SHALL allow users to create new tours with an optional name, optional planned date (date picker), and partner selection (contact chips).

#### Scenario: Create tour with all fields

- **WHEN** the user fills in a name, selects a date, toggles partner contacts, and submits
- **THEN** the dialog SHALL return a TourDraft object with the selected values

#### Scenario: Create tour with minimal fields

- **WHEN** the user submits without filling any optional fields
- **THEN** the dialog SHALL return a TourDraft with null name, null date, and empty partner list

### Requirement: Tour info display

A component SHALL display tour details including name, planned date, coordinates, and partner names as chips.

#### Scenario: Display tour with partners

- **WHEN** the tour info component is shown for a tour with partners
- **THEN** it SHALL display the tour name (or "Unnamed tour"), formatted date, coordinates, and partner names resolved from the contacts store

#### Scenario: Display tour without partners

- **WHEN** the tour info component is shown for a tour with no partners
- **THEN** it SHALL display the tour details without a partners section

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
