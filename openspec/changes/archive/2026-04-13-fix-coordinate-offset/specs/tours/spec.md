## MODIFIED Requirements

### Requirement: Tour creation dialog

A dialog component SHALL allow users to create new tours with an optional name, optional planned date (date picker), and partner selection (contact chips).

#### Scenario: Location picker captures coordinates at visual crosshair center

- **WHEN** the user confirms a location in the location picker
- **THEN** the component SHALL read the geographic coordinates at the pixel center of the map canvas using `map.unproject()`, NOT `map.getCenter()`
- **AND** the coordinates SHALL match the visual position of the crosshair overlay regardless of any active map padding

#### Scenario: Coordinates accurate after viewing tour with padding

- **WHEN** a user has previously viewed a tour (which applies map padding via `flyTo`)
- **AND** then enters location picking mode and confirms a location
- **THEN** the saved coordinates SHALL correspond to the crosshair's visual position, not the padded viewport center
