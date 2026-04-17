## ADDED Requirements

### Requirement: Single active overlay at any time

At most one modal overlay (any `BottomSheet` consumer or the `SideDrawer`-rendered `TourInfoSheet`) SHALL be visible to the user at any time. Opening a new overlay SHALL automatically close the previously open overlay before the new overlay becomes visible.

#### Scenario: Opening a new bottom sheet closes the currently open bottom sheet

- **WHEN** the feedback bottom sheet is open
- **AND** the user opens the contacts list bottom sheet
- **THEN** the feedback bottom sheet SHALL be removed from the DOM
- **AND** only the contacts list bottom sheet SHALL be visible

#### Scenario: Selecting a tour marker closes any open bottom sheet

- **WHEN** any modal bottom sheet (feedback, profile, or contacts list) is open
- **AND** the user clicks a tour marker on the map
- **THEN** the open bottom sheet SHALL be removed from the DOM
- **AND** the tour info overlay SHALL be the only visible overlay

#### Scenario: Opening a bottom sheet while a tour is selected deselects the tour

- **WHEN** the tour info overlay is visible (mobile bottom sheet or desktop side drawer)
- **AND** the user opens any other modal overlay (feedback, profile, or contacts list)
- **THEN** the tour info overlay SHALL be removed from the DOM
- **AND** the selected tour SHALL be cleared from application state
- **AND** only the newly opened overlay SHALL be visible
