## ADDED Requirements

### Requirement: Dismiss modal bottom sheets via map background click

The map SHALL dismiss any open modal bottom sheet when the user performs a discrete click or tap on the map background (i.e., not on a tour marker and not on the sheet itself).

#### Scenario: Background tap closes the tour info sheet

- **WHEN** a tour info sheet is open and the user taps on an empty area of the map
- **THEN** the tour info sheet closes and the selected tour is cleared

#### Scenario: Background tap closes the feedback sheet

- **WHEN** the feedback sheet is open and the user taps on an empty area of the map
- **THEN** the feedback sheet closes

#### Scenario: Background tap closes the user profile sheet

- **WHEN** the user profile sheet is open and the user taps on an empty area of the map
- **THEN** the user profile sheet closes

#### Scenario: Tap on the sheet does not dismiss it

- **WHEN** a modal bottom sheet is open and the user taps inside the sheet's bounds
- **THEN** the sheet remains open and its internal interaction is handled normally

#### Scenario: Tap on a tour marker switches instead of dismissing

- **WHEN** a tour info sheet is open for tour A and the user taps a different tour marker B
- **THEN** the tour info sheet for tour B is shown (no intermediate empty state)

#### Scenario: Map gestures do not dismiss the sheet

- **WHEN** a sheet is open and the user pans, zooms, rotates, or pitches the map
- **THEN** the sheet remains open

#### Scenario: Dedicated close control still works

- **WHEN** a sheet is open and the user activates the sheet's existing close button or icon
- **THEN** the sheet closes as before
