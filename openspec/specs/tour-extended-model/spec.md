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

The `TourDraft` interface SHALL be expanded to include all new optional fields: `tourType`, `elevation`, `gpxTrack`, `description`, `seasons`, `startPoint`, `endPoint`, `equipment`, `notes`.

#### Scenario: Draft with all fields

- **WHEN** a TourDraft is created with all new fields populated
- **THEN** it SHALL be a valid TourDraft object

#### Scenario: Draft with no new fields (backward compatible)

- **WHEN** a TourDraft is created with only name, plannedDate, and partnerIds
- **THEN** it SHALL be valid with all new fields defaulting to null/undefined

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
