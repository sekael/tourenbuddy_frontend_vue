## Purpose

Overlay component that renders as a bottom sheet on mobile and a centered dialog on desktop based on viewport size.

## Requirements

### Requirement: Single active overlay at any time

At most one modal overlay SHALL be visible on the map page at any time. The overlay set includes: every `AdaptiveOverlay` consumer (feedback, user profile, contacts list), the tour-creation dialog, and the tour-info side drawer. Opening a new overlay SHALL automatically close the previously open overlay before the new overlay becomes visible.

#### Scenario: Opening a new bottom sheet closes the currently open bottom sheet

- **WHEN** the feedback overlay is open on a mobile viewport
- **AND** the user opens the contacts list overlay
- **THEN** the feedback overlay SHALL be removed from the DOM
- **AND** only the contacts list overlay SHALL be visible

#### Scenario: Opening a new dialog closes the currently open dialog on desktop

- **WHEN** the feedback overlay is open on a viewport at or above 600px
- **AND** the user opens the contacts list overlay
- **THEN** the feedback dialog SHALL be removed from the DOM
- **AND** only the contacts list dialog SHALL be visible

#### Scenario: Selecting a tour marker closes any open overlay

- **WHEN** any overlay (feedback, profile, contacts list, or tour-creation) is open
- **AND** the user clicks a tour marker on the map
- **THEN** the open overlay SHALL be removed from the DOM
- **AND** the tour info overlay SHALL be the only visible overlay

#### Scenario: Opening an overlay while a tour is selected deselects the tour

- **WHEN** the tour info overlay is visible (mobile bottom sheet or desktop side drawer)
- **AND** the user opens any other overlay (feedback, profile, contacts list, or tour-creation)
- **THEN** the tour info overlay SHALL be removed from the DOM
- **AND** the selected tour SHALL be cleared from application state
- **AND** only the newly opened overlay SHALL be visible

#### Scenario: Opening tour-creation closes any open overlay on desktop

- **WHEN** the feedback, profile, contacts list, or tour-info overlay is visible on a viewport at or above 600px
- **AND** the user initiates a new tour creation (picks a goal location)
- **THEN** the previously open overlay SHALL be removed from the DOM
- **AND** only the tour-creation dialog SHALL be visible

### Requirement: Adaptive overlay renders as centered dialog on desktop

Overlays used for feedback, user profile, contacts list, and tour creation SHALL render as a centered `DialogWindow` on viewports at or above 600px and as a `BottomSheet` on viewports below 600px. The `TourInfoSheet` does not use this adaptive overlay — it continues to use the `SideDrawer` component which itself adapts between a `BottomSheet` (<600px) and a right-edge drawer (≥600px).

#### Scenario: Desktop dialog appearance

- **WHEN** the viewport width is at or above 600px
- **AND** one of the listed overlays is rendered
- **THEN** the overlay SHALL render as a `DialogWindow` centered both vertically and horizontally within the viewport
- **AND** the overlay SHALL NOT be anchored to the bottom of the viewport
- **AND** no drag handle SHALL be displayed

#### Scenario: Desktop backdrop scrim

- **WHEN** the viewport width is at or above 600px
- **AND** one of the listed overlays is rendered
- **THEN** a full-screen semi-transparent backdrop (`rgba(15, 23, 42, 0.35)`) with `backdrop-filter: blur(2px)` SHALL be displayed behind the dialog

#### Scenario: Desktop fade-scale animation

- **WHEN** one of the listed overlays enters the DOM on a viewport at or above 600px
- **THEN** it SHALL animate in with a fade-in and subtle scale-up transition (from `opacity: 0; scale(0.95)` to `opacity: 1; scale(1)`)
- **AND** when leaving, it SHALL animate out with a fade-out and subtle scale-down

#### Scenario: Mobile bottom sheet unchanged

- **WHEN** the viewport width is below 600px
- **AND** one of the listed overlays is rendered
- **THEN** the overlay SHALL render as a `BottomSheet` anchored to the bottom edge, with drag handle, using the existing slide-up animation

#### Scenario: TourInfoSheet uses SideDrawer on desktop

- **WHEN** the viewport width is at or above 600px
- **AND** a tour is selected
- **THEN** the `TourInfoSheet` SHALL render inside a `SideDrawer` instead of a `DialogWindow` or `BottomSheet`
