## Purpose

Suggest a tour name based on the selected map location using Swisstopo reverse-geocoding.

## Requirements

### Requirement: Name suggestion service

A service SHALL query the Swisstopo GeoAdmin search API to find named geographic features near given coordinates.

#### Scenario: Named feature found

- **WHEN** `suggestName({ lng, lat })` is called near a known peak, pass, or hut
- **THEN** the service SHALL return the name of the closest named feature as a string

#### Scenario: No named feature nearby

- **WHEN** `suggestName({ lng, lat })` is called in an area with no nearby named features
- **THEN** the service SHALL return `null`

#### Scenario: API timeout or error

- **WHEN** the Swisstopo search API does not respond within 5 seconds or returns an error
- **THEN** the service SHALL return `null` and log a warning

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
