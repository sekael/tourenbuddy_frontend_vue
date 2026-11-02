## MODIFIED Requirements

### Requirement: Map controls are legible and stand out from the map

Floating map controls (menu trigger and items, compass, action bar, base-map options) SHALL share one glass surface and render their labels and icons with at least 4.5:1 contrast against it, including the surface's translucency over a white map, and SHALL remain visually separated from the map background. The guided-tour banner SHALL use the same map-control blue as an opaque surface. Indicators on a control (notification dot, count badge) SHALL contrast with the control.

#### Scenario: Labels over a bright map

- **WHEN** the speed-dial menu is open over a white map area
- **THEN** every item label reads at ≥ 4.5:1 and the controls are distinct from the map

#### Scenario: Guided-tour finish button

- **WHEN** the guided tour banner is shown
- **THEN** the "finish tour" label reads at ≥ 4.5:1 against the button behind it

### Requirement: Floating toasts clear open sheets

Bottom-anchored toasts and status chips SHALL sit above the tallest open bottom sheet or, on a phone, the track-drawing panel (`--sheet-inset`), above the location picker's hint, search field and buttons (`--dock-inset`), and above the map's bottom control row while it shows (`--bar-inset`). They SHALL keep their usual position when none is up, glide along as a sheet rises or leaves, and share one spot: a new message replaces the one showing.

#### Scenario: Error while a sheet is open

- **WHEN** an error snackbar appears while the tour sheet is open on mobile
- **THEN** the snackbar sits above the sheet and none of the sheet's actions are covered

#### Scenario: Error while picking a point

- **WHEN** a ski route's details fail to load while the user picks a new tour's goal on a phone
- **THEN** the error sits above the picker's hint and buttons, legible and covering none of them

#### Scenario: Sync message on the plain map

- **WHEN** "1 change synced" appears on the map with nothing open
- **THEN** it sits just above the bottom bar, and "My tours", add-tour, the info and the menu button stay visible and tappable

#### Scenario: Sync message while drawing a track

- **WHEN** the connection returns while the user draws a track on a phone
- **THEN** the synced message sits just above the drawing panel, covering none of undo, redo, back to start or Done
