## ADDED Requirements

### Requirement: GPX file upload

The tour creation dialog SHALL allow users to upload a GPX file (`.gpx` extension, max 2MB).

#### Scenario: Valid GPX uploaded

- **WHEN** the user selects a valid GPX file under 2MB
- **THEN** the system SHALL parse it to GeoJSON using `@tmcw/togeojson` and store the result in the tour draft

#### Scenario: File too large

- **WHEN** the user selects a GPX file over 2MB
- **THEN** the system SHALL show an error message and reject the file

#### Scenario: Invalid GPX file

- **WHEN** the user selects a file that cannot be parsed as valid GPX
- **THEN** the system SHALL show an error message and reject the file

#### Scenario: Remove uploaded GPX

- **WHEN** the user has uploaded a GPX file and clicks remove
- **THEN** the GPX data SHALL be cleared from the tour draft

### Requirement: GPX track rendering on map

When a tour has a GPX track, it SHALL be rendered as a polyline on the MapLibre map.

#### Scenario: Tour with GPX track selected

- **WHEN** a tour with a GPX track is selected on the map
- **THEN** the track SHALL be rendered as a colored polyline layer on the map

#### Scenario: Tour without GPX track selected

- **WHEN** a tour without a GPX track is selected
- **THEN** no polyline layer SHALL be rendered

#### Scenario: Deselect tour hides track

- **WHEN** a tour with a visible GPX track is deselected
- **THEN** the polyline layer SHALL be removed from the map

### Requirement: GPX track storage

GPX tracks SHALL be stored as GeoJSON in a `jsonb` column on the tours table.

#### Scenario: Tour saved with GPX

- **WHEN** a tour is created with a GPX track
- **THEN** the GeoJSON representation SHALL be persisted in the `gpx_track` column

#### Scenario: Tour saved without GPX

- **WHEN** a tour is created without a GPX track
- **THEN** the `gpx_track` column SHALL be null
