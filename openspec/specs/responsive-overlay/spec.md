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

### Requirement: Adaptive overlay renders as centered dialog on desktop

The `BottomSheet` component SHALL render as a vertically and horizontally centered dialog on viewports at or above 600px, with full rounded corners, no drag handle, and a semi-transparent backdrop with blur. This behavior applies to all `BottomSheet` consumers. The `TourInfoSheet` does not use `BottomSheet` on desktop — it uses the `SideDrawer` component instead.

#### Scenario: Desktop dialog appearance

- **WHEN** the viewport width is at or above 600px
- **AND** a `BottomSheet` component is rendered
- **THEN** the sheet SHALL be centered both vertically and horizontally within the viewport
- **AND** the sheet SHALL have fully rounded corners (`border-radius` on all sides)
- **AND** the drag handle SHALL be hidden
- **AND** the bottom border SHALL be rendered (unlike mobile where it is hidden)

#### Scenario: Desktop backdrop scrim

- **WHEN** the viewport width is at or above 600px
- **AND** a `BottomSheet` component is rendered
- **THEN** a full-screen semi-transparent backdrop (`rgba(15, 23, 42, 0.35)`) with `backdrop-filter: blur(2px)` SHALL be displayed behind the dialog

#### Scenario: Desktop fade-scale animation

- **WHEN** a `BottomSheet` enters the DOM on a viewport at or above 600px
- **THEN** it SHALL animate in with a fade-in and subtle scale-up transition (from `opacity: 0; scale(0.95)` to `opacity: 1; scale(1)`)
- **AND** when leaving, it SHALL animate out with a fade-out and subtle scale-down

#### Scenario: TourInfoSheet uses SideDrawer on desktop

- **WHEN** the viewport width is at or above 600px
- **AND** a tour is selected
- **THEN** the `TourInfoSheet` SHALL render inside a `SideDrawer` instead of a `BottomSheet`
