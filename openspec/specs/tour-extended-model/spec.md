## Purpose

Extended tour entity fields beyond the baseline (e.g., difficulty, duration estimate, description) and their persistence.

## Requirements

### Requirement: Tour type enum

A Zod enum SHALL define the allowed tour activity types: `skiing-snowboarding`, `skitour-splitboarding`, `ski-mountaineering`, `paragliding`, `hiking`, `mountaineering`, `climbing`, `mountain-biking`, `trailrunning`.

#### Scenario: Valid tour type parsed

- **WHEN** a tour row contains a `tour_type` value matching one of the enum values
- **THEN** the schema SHALL parse it into the corresponding TypeScript union type

#### Scenario: Null tour type

- **WHEN** a tour row has `tour_type` as null
- **THEN** the schema SHALL accept it as a valid optional field with value `null`

### Requirement: Elevation field

The tour schema SHALL include an `elevation` field (number, nullable) representing meters above sea level at the tour goal point.

#### Scenario: Elevation present

- **WHEN** a tour row contains a numeric `elevation` value
- **THEN** the schema SHALL parse it as a number (meters)

#### Scenario: Elevation absent

- **WHEN** a tour row has `elevation` as null
- **THEN** the schema SHALL accept it as null

### Requirement: GPX track as GeoJSON

The tour schema SHALL include a `gpxTrack` field (GeoJSON FeatureCollection, nullable) for storing parsed GPX track data.

#### Scenario: Tour with GPX track

- **WHEN** a tour row contains a `gpx_track` jsonb value
- **THEN** the schema SHALL parse it as a GeoJSON FeatureCollection

#### Scenario: Tour without GPX track

- **WHEN** a tour row has `gpx_track` as null
- **THEN** the schema SHALL accept it as null

### Requirement: Description field

The tour schema SHALL include a `description` field (string, nullable) for free-text tour guides and route descriptions.

#### Scenario: Description with URLs

- **WHEN** a tour has a description containing URLs
- **THEN** the schema SHALL store the raw text (URL rendering is a presentation concern)

### Requirement: Season multi-select

The tour schema SHALL include a `seasons` field (array of season enum values, nullable). Season values: `winter`, `spring`, `summer`, `autumn`.

#### Scenario: Multiple seasons selected

- **WHEN** a tour has seasons `['winter', 'spring']`
- **THEN** the schema SHALL validate both values against the season enum

#### Scenario: No seasons

- **WHEN** a tour has `seasons` as null or empty array
- **THEN** the schema SHALL accept it

### Requirement: Start and end points

The tour schema SHALL include `startPoint` (object with lng/lat, nullable) and `endPoint` (object with lng/lat, nullable).

#### Scenario: Start point without end point

- **WHEN** a tour has `startPoint` set but `endPoint` is null
- **THEN** the end point SHALL be treated as equal to start point (round trip) at the presentation layer

#### Scenario: Both points set

- **WHEN** a tour has both `startPoint` and `endPoint` set
- **THEN** both SHALL be parsed as `{ lng: number, lat: number }` objects

### Requirement: Equipment field

The tour schema SHALL include an `equipment` field (string, nullable) for free-text gear lists.

#### Scenario: Equipment present

- **WHEN** a tour row has an `equipment` text value
- **THEN** the schema SHALL parse it as a string

### Requirement: Notes field

The tour schema SHALL include a `notes` field (string, nullable) for miscellaneous free-text information.

#### Scenario: Notes present

- **WHEN** a tour row has a `notes` text value
- **THEN** the schema SHALL parse it as a string

### Requirement: Extended TourDraft

The `TourDraft` interface SHALL be expanded to include all new optional fields: `tourType`,
`elevation`, `gpxTrack`, `description`, `seasons`, `startPoint`, `endPoint`, `equipment`,
`notes`, `endDate`.

#### Scenario: Draft with all fields

- **WHEN** a TourDraft is created with all new fields populated
- **THEN** it SHALL be a valid TourDraft object

#### Scenario: Draft with no new fields (backward compatible)

- **WHEN** a TourDraft is created with only name, plannedDate, and partnerIds
- **THEN** it SHALL be valid with all new fields defaulting to null/undefined, and the tour
  SHALL be persisted as a single-day tour

### Requirement: Completed field

The tour schema SHALL include a `completed` field (boolean, non-nullable) indicating whether the user has marked the tour as done. The field SHALL default to `false` when absent from the source row.

#### Scenario: Tour explicitly completed

- **WHEN** a tour row has `completed = true`
- **THEN** the schema SHALL parse it as the boolean `true`

#### Scenario: Tour explicitly not completed

- **WHEN** a tour row has `completed = false`
- **THEN** the schema SHALL parse it as the boolean `false`

#### Scenario: Legacy row missing column

- **WHEN** a tour row lacks the `completed` column (pre-migration client-side cache)
- **THEN** the schema SHALL default the field to `false`

### Requirement: Extended TourDraft includes completion state

The `TourDraft` interface and tour update payload type SHALL accept an optional `completed` boolean so existing update paths can patch the field.

#### Scenario: Patch with completed true

- **WHEN** an update payload `{ completed: true }` is passed to the tour repository update method
- **THEN** the payload SHALL be valid and persisted to the `completed` column

### Requirement: End date field

The tour schema SHALL include an `endDate` field (date, nullable) representing the last day
of a multi-day tour, where `plannedDate` is the first day. A null `endDate` SHALL mean a
single-day tour and SHALL be indistinguishable in behaviour from the model before this
capability existed.

The persisted column SHALL be `tours.end_date date`, exposed as `end_date` by `tours_view`
and `friend_tours_view`, and SHALL be constrained such that `end_date >= planned_date`
whenever both are non-null.

The tour write RPCs `create_tour_full` and `update_tour_full` SHALL accept the span end as a
trailing `p_end_date date` argument defaulting to null, so a call that omits it persists a
single-day tour.

#### Scenario: Row without an end date

- **WHEN** a tour row is read whose `end_date` is null
- **THEN** the mapped tour SHALL have `endDate === null` and SHALL be treated as a single-day
  tour by every consumer

#### Scenario: Row with an end date

- **WHEN** a tour row is read with `planned_date = 2026-08-25` and `end_date = 2026-08-27`
- **THEN** the mapped tour SHALL have both dates set and SHALL be treated as spanning three
  days inclusive

#### Scenario: End date before start date is rejected

- **WHEN** a write is attempted with `end_date` earlier than `planned_date`
- **THEN** the database CHECK constraint SHALL reject the write

#### Scenario: Write RPC called without the end-date argument

- **WHEN** `create_tour_full` or `update_tour_full` is invoked without `p_end_date` (for
  example by an offline write queued before this capability shipped)
- **THEN** the call SHALL succeed and the tour SHALL be persisted with `end_date` null
