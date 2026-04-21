## MODIFIED Requirements

### Requirement: Location picker with crosshair

The map SHALL support a location-picking mode where a crosshair overlay appears at the center of the viewport, and the user can pan to choose a location. While picking is active, the location picker SHALL be the only interactive UI; any open tour edit or tour creation surface SHALL be suspended (collapsed to a title-only header, inputs disabled, dismissal affordances hidden) and any submit path SHALL refuse to execute until picking ends. On confirm or cancel, picking ends and the suspended surface SHALL be restored to its prior interactive state.

#### Scenario: Enter location picker mode

- **WHEN** the user clicks the "Add Location" button
- **THEN** a crosshair overlay SHALL appear at the center of the map, the map action buttons SHALL hide, and cancel/continue FABs SHALL appear

#### Scenario: Confirm location

- **WHEN** the user clicks "Continue" in location picker mode
- **THEN** the app SHALL capture the map center coordinates and open the tour creation dialog with those coordinates

#### Scenario: Cancel location picking

- **WHEN** the user clicks "Cancel" in location picker mode
- **THEN** the crosshair SHALL disappear, the map action buttons SHALL reappear, and no tour is created

#### Scenario: Disabled when not logged in

- **WHEN** the user is not authenticated
- **THEN** the "Add Location" button SHALL be disabled

#### Scenario: Suspends an open tour edit surface while picking

- **WHEN** the location picker is active
- **AND** a tour info sheet is open in edit mode
- **THEN** the tour edit surface SHALL render in a collapsed header-only state showing "Edit: <tour title>"
- **AND** all form inputs and non-picker action buttons inside the edit surface SHALL be disabled
- **AND** backdrop / map-background / Escape dismissal of the edit surface SHALL be suppressed
- **AND** the edit surface SHALL NOT expose a close button

#### Scenario: Suspends the tour creation dialog while re-picking

- **WHEN** the location picker is re-opened from within the tour creation dialog to pick start, end, or goal
- **THEN** the tour creation dialog SHALL be suspended equivalently (collapsed header, disabled inputs, dismissal suppressed) until picking ends

#### Scenario: Restores the suspended surface on confirm

- **WHEN** the user confirms the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the newly picked coordinates applied to the target field, and all other in-progress form values SHALL be preserved

#### Scenario: Restores the suspended surface on cancel

- **WHEN** the user cancels the picker
- **THEN** picking SHALL end
- **AND** the previously suspended surface SHALL be restored to full interactive state with the target field unchanged, and all other in-progress form values SHALL be preserved
