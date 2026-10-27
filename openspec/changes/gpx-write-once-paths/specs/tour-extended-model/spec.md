## MODIFIED Requirements

### Requirement: GPX track reference

The tour schema SHALL include a `gpxFilepath` field (string, nullable) holding the object key of the tour's GPX file in the private `tour-gpx` Storage bucket (`<owner uid>/<id>.gpx`, where `id` is the tour's id for a track added at creation and a fresh UUID for any later one — see `gpx-tracks`). The track itself is never stored in the row; it is fetched and parsed on demand (see `gpx-tracks`).

#### Scenario: Tour with GPX track

- **WHEN** a tour row contains a non-null `gpx_filepath`
- **THEN** the schema SHALL parse it as the string `gpxFilepath`

#### Scenario: Tour without GPX track

- **WHEN** a tour row has `gpx_filepath` as null
- **THEN** the schema SHALL accept it as null
