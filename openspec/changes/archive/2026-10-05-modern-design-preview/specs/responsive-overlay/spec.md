## RENAMED Requirements

- FROM: `### Requirement: Adaptive overlay renders as centered dialog on desktop`
- TO: `### Requirement: Adaptive overlay renders as a content-sized dialog on desktop`

## MODIFIED Requirements

### Requirement: Adaptive overlay renders as a content-sized dialog on desktop

Overlays used for feedback, user profile, contacts list, friend requests, offline maps, and tour creation SHALL render as a `DialogWindow` on viewports at or above 600px and as a `BottomSheet` (or, in data-entry mode, a full-screen page) on viewports below 600px. On desktop the dialog SHALL be sized by its current content and hang from a fixed top inset (see `dialog-window`). The `TourInfoSheet` does not use this adaptive overlay — it continues to use the `SideDrawer` component which itself adapts between a `BottomSheet` (<600px) and a right-edge drawer (≥600px).

#### Scenario: Desktop dialog appearance

- **WHEN** the viewport width is at or above 600px
- **AND** one of the listed overlays is rendered
- **THEN** the overlay SHALL render as a `DialogWindow`, centered horizontally and hanging from the top inset, as tall as its content
- **AND** the overlay SHALL NOT be anchored to the bottom of the viewport
- **AND** no drag handle SHALL be displayed

#### Scenario: Desktop views of different height

- **WHEN** the user moves between views or tabs inside one of the listed overlays on desktop
- **THEN** the dialog SHALL glide to the new view's height while its header stays in place

#### Scenario: Desktop backdrop scrim

- **WHEN** the viewport width is at or above 600px
- **AND** one of the listed overlays is rendered
- **THEN** a full-screen semi-transparent backdrop (`var(--color-backdrop)`) with `backdrop-filter: blur(var(--overlay-backdrop-blur))` SHALL be displayed behind the dialog

#### Scenario: Desktop fade-scale animation

- **WHEN** one of the listed overlays enters the DOM on a viewport at or above 600px
- **THEN** its dialog card SHALL fade in with a short drop onto its top line and a subtle scale-up

#### Scenario: Mobile bottom sheet unchanged

- **WHEN** the viewport width is below 600px
- **AND** one of the listed overlays is rendered outside data-entry mode
- **THEN** the overlay SHALL render as a `BottomSheet` anchored to the bottom edge, with drag handle, using the existing slide-up animation

#### Scenario: TourInfoSheet uses SideDrawer on desktop

- **WHEN** the viewport width is at or above 600px
- **AND** a tour is selected
- **THEN** the `TourInfoSheet` SHALL render inside a `SideDrawer` instead of a `DialogWindow` or `BottomSheet`
