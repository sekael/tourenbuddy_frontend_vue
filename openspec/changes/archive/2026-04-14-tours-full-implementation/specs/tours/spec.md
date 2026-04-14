## MODIFIED Requirements

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
