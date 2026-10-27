## ADDED Requirements

### Requirement: Escape closes the drawer

On desktop, pressing Escape SHALL close an open, expanded side drawer exactly as its close button does, wherever keyboard focus is (a click on the map leaves focus on the map). Escape SHALL NOT close the drawer while focus is in a text field, select or editable region, while a dialog is open above the drawer, while the drawer is collapsed, or when a control inside (an open filter panel, menu, tooltip or stack list) has already used that keypress; the next Escape then closes the drawer.

#### Scenario: Escape after clicking the map

- **GIVEN** a tour's detail drawer is open and the user last clicked the map
- **WHEN** the user presses Escape
- **THEN** the drawer SHALL close

#### Scenario: Escape while typing

- **GIVEN** the tour list drawer is open with focus in its search field
- **WHEN** the user presses Escape
- **THEN** the drawer SHALL stay open

#### Scenario: Escape folds the filters first

- **GIVEN** the tour list drawer is open with its filters expanded and focus on a filter
- **WHEN** the user presses Escape twice
- **THEN** the first press SHALL fold the filters and the second SHALL close the drawer
