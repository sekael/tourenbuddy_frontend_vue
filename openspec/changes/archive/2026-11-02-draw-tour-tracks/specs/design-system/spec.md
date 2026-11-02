## MODIFIED Requirements

### Requirement: Floating toasts clear open sheets

Bottom-anchored toasts and status chips SHALL sit above the tallest open bottom sheet (`--sheet-inset`) and above the location picker's hint, search field and buttons (`--dock-inset`), and keep their usual position when neither is up.

#### Scenario: Error while a sheet is open

- **WHEN** an error snackbar appears while the tour sheet is open on mobile
- **THEN** the snackbar sits above the sheet and none of the sheet's actions are covered

#### Scenario: Error while picking a point

- **WHEN** a ski route's details fail to load while the user picks a new tour's goal on a phone
- **THEN** the error sits above the picker's hint and buttons, legible and covering none of them
