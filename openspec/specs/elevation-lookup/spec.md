## Purpose

Resolve elevation in meters for a coordinate via the Swisstopo elevation API.

## Requirements

### Requirement: WGS84 to LV95 coordinate transformation

A utility function `wgs84ToLv95(lng: number, lat: number): { easting: number, northing: number }` SHALL convert WGS84 (EPSG:4326) longitude/latitude to Swiss LV95 (EPSG:2056) easting/northing using the swisstopo approximate polynomial formulas.

#### Scenario: Known reference point conversion

- **WHEN** `wgs84ToLv95(7.43863, 46.95108)` is called (Bern Federal Palace)
- **THEN** the result SHALL be approximately `{ easting: 2600000, northing: 1200000 }` within ±2m accuracy

#### Scenario: Coordinate at Swiss border

- **WHEN** `wgs84ToLv95` is called with coordinates at the edge of Swiss territory
- **THEN** it SHALL return valid LV95 coordinates (no bounds check — the elevation API handles out-of-bounds)

### Requirement: Elevation lookup service

A service SHALL convert WGS84 coordinates to LV95, then query the Swisstopo height API with EPSG:2056 parameters to retrieve elevation.

#### Scenario: Successful elevation retrieval

- **WHEN** `getElevation({ lng, lat })` is called with WGS84 coordinates within Switzerland
- **THEN** the service SHALL convert to LV95 via `wgs84ToLv95`, call `https://api3.geo.admin.ch/rest/services/height?easting={E}&northing={N}&sr=2056`, and return the elevation in meters as a number

#### Scenario: Coordinates outside Switzerland

- **WHEN** `getElevation({ lng, lat })` is called with coordinates outside Swiss territory
- **THEN** the service SHALL return `null` without throwing an error

#### Scenario: API timeout

- **WHEN** the Swisstopo API does not respond within 5 seconds
- **THEN** the service SHALL return `null` and log a warning via the logger composable

#### Scenario: API error

- **WHEN** the Swisstopo API returns an error response
- **THEN** the service SHALL return `null` and log the error

### Requirement: Elevation auto-fill on location confirm

After the user confirms a map location, the elevation lookup SHALL fire automatically and pre-populate the elevation field in the tour creation dialog.

#### Scenario: Elevation pre-filled

- **WHEN** the user confirms a location and elevation lookup succeeds
- **THEN** the tour creation dialog SHALL open with the elevation field pre-filled with the retrieved value
- **AND** the user SHALL be able to manually override the value

#### Scenario: Elevation lookup fails

- **WHEN** the user confirms a location and elevation lookup returns null
- **THEN** the tour creation dialog SHALL open with an empty elevation field for manual entry
