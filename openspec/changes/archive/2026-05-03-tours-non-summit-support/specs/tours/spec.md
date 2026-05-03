## MODIFIED Requirements

### Requirement: Tour model with Zod validation

A Zod schema SHALL define the tour shape: `id` (string), `userId` (string), `plannedDate` (date, nullable), `goal` (object with `lng` and `lat` as numbers), `name` (string, nullable), `partnerIds` (array of strings), `tourType` (tour type enum, nullable), `elevation` (number, nullable), `gpxTrack` (GeoJSON FeatureCollection, nullable), `description` (string, nullable), `seasons` (array of season enum, nullable), `startPoint` (object with `lng` and `lat`, nullable), `startPointName` (string, nullable), `startPointElevation` (number, nullable), `endPoint` (object with `lng` and `lat`, nullable), `endPointName` (string, nullable), `endPointElevation` (number, nullable), `equipment` (string, nullable), `notes` (string, nullable).

#### Scenario: Valid tour from Supabase tours_view

- **WHEN** a tour row is fetched from the `tours_view`
- **THEN** the Zod schema SHALL parse it into a typed `Tour` object, converting snake_case columns to camelCase properties, `lon`/`lat` to `goal` object, `start_lon`/`start_lat`/`end_lon`/`end_lat` to point objects, and `start_point_name`, `start_point_elevation`, `end_point_name`, `end_point_elevation` to their camelCase counterparts

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
- **THEN** the repository SHALL pass all fields to the Supabase RPC including `p_tour_type`, `p_elevation`, `p_gpx_track`, `p_description`, `p_seasons`, `p_start_point`, `p_start_point_name`, `p_start_point_elevation`, `p_end_point`, `p_end_point_name`, `p_end_point_elevation`, `p_equipment`, `p_notes`

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
- **THEN** the repository SHALL call `update_tour_full` with `p_id`, `p_planned_date`, `p_name`, `p_goal`, `p_partner_ids`, `p_tour_type`, `p_elevation`, `p_gpx_track`, `p_description`, `p_seasons`, `p_start_point`, `p_start_point_name`, `p_start_point_elevation`, `p_end_point`, `p_end_point_name`, `p_end_point_elevation`, `p_equipment`, `p_notes`

#### Scenario: Update tour clearing optional fields

- **WHEN** `updateTour` is called with a draft where optional fields are null
- **THEN** the repository SHALL pass null for each corresponding RPC parameter so the row is cleared

#### Scenario: Update returns error on RPC failure

- **WHEN** the Supabase RPC returns an error
- **THEN** the repository SHALL throw an `Error` carrying the RPC error message
