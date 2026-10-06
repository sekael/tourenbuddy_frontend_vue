## ADDED Requirements

### Requirement: Touch feedback without sticky hover

Hover fills SHALL apply only on devices whose primary pointer can hover (`@media (hover: hover)`); the same fill SHALL show while the control is pressed (`:active`). The platform tap highlight SHALL be disabled and controls SHALL not wait for double-tap zoom.

#### Scenario: Tapping a list row on a phone

- **WHEN** the user taps a tour row on a touch device and lifts the finger
- **THEN** the row shows its tint while pressed and returns to rest after release, with no grey tap flash

### Requirement: Floating toasts clear open sheets

Bottom-anchored toasts and status chips SHALL sit above the tallest open bottom sheet (`--sheet-inset`) and keep their usual position when no sheet is open.

#### Scenario: Error while a sheet is open

- **WHEN** an error snackbar appears while the tour sheet is open on mobile
- **THEN** the snackbar sits above the sheet and none of the sheet's actions are covered

### Requirement: Quitting the guided tour returns to the starting point

Finishing the guided tour early SHALL NOT open any further surface, even when it is finished while the tour is navigating to a step; the user SHALL be returned to the overlay that was open when the tour started (or the plain map).

#### Scenario: Finish while the tour opens the menu

- **WHEN** the user taps "Finish tour" while the tour is spotlighting the speed-dial on its way to the contacts step
- **THEN** neither the speed-dial menu nor the contacts sheet opens

#### Scenario: Tour started from the profile

- **WHEN** the user starts "Show app tour" from the profile sheet and finishes it early
- **THEN** the profile sheet is open again

### Requirement: Tour detail reads at a glance

The tour detail view SHALL open with a header card (tour type as a filled badge, planned date, owner for friend tours), followed by labelled sections: Route (goal elevation as the headline number with coordinates, start and finish as tiles), Details (seasons, description, equipment, notes as label-over-text with relaxed line height) and Partners. Facts SHALL carry visible labels rather than icon-only tooltips. The view SHALL be tinted with the tour's activity colour (the map marker colour): badge, header card, goal tile, label icons, season chips, detail icons and partner avatars. A completed tour SHALL show a success ring on the header card and a check stamp on the badge (and a "Completed" pill for friends viewing it); a private tour SHALL show a dashed edge and a lock stamp. Details SHALL render as one card with an icon per text; partners as avatar pills with a count.

#### Scenario: Reading a tour on a phone

- **WHEN** the user opens a tour with an elevation, start point and description
- **THEN** the elevation is the most prominent number, start and finish sit side by side, and the description is under a "Description" label
