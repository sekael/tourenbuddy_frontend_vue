## Purpose

Suggest a tour name based on the selected map location using Swisstopo reverse-geocoding.

## Requirements

### Requirement: Name suggestion service

A service (`suggestTourName` in `swisstopo-name-service.ts`) SHALL query the Swisstopo GeoAdmin identify API on the `ch.swisstopo.swissnames3d` layer, in LV95 coordinates, for named features near the given point: first within 50 m, then within 500 m when nothing is found. Results SHALL be ranked by feature-type priority (`objektart`) and the best match's `name` (or HTML-stripped `label`) returned.

#### Scenario: Named feature found

- **WHEN** `suggestTourName({ lng, lat })` is called near a known peak, pass, or hut
- **THEN** the service SHALL return the name of the closest named feature as a string

#### Scenario: No named feature nearby

- **WHEN** `suggestTourName({ lng, lat })` is called in an area with no named feature within 500 m
- **THEN** the service SHALL return `null`

#### Scenario: API timeout or error

- **WHEN** the identify API does not respond within 5 seconds or returns an error
- **THEN** the service SHALL return `null` and log it

### Requirement: Name auto-suggestion on location confirm

After the user confirms a map location, a name suggestion SHALL be fetched and offered as a pre-filled value in the name field.

#### Scenario: Name suggested and accepted

- **WHEN** a name suggestion is available and the user does not modify it
- **THEN** the tour SHALL be created with the suggested name

#### Scenario: Name suggested but overridden

- **WHEN** a name suggestion is available and the user types a different name
- **THEN** the tour SHALL use the user-entered name

#### Scenario: No suggestion available

- **WHEN** no name suggestion is returned
- **THEN** the name field SHALL remain empty for manual entry
