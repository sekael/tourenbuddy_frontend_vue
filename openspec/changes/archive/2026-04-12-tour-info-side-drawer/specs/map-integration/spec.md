## MODIFIED Requirements

### Requirement: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

The camera offset behavior SHALL be responsive: on mobile viewports (<600px), the map SHALL apply bottom padding equal to the sheet height to keep the tour marker visible above the sheet. On desktop viewports (>=600px), the map SHALL apply right padding equal to the side drawer width to keep the tour marker centered in the visible map area beside the drawer.

#### Scenario: Tour selection shows info

- **WHEN** a user clicks on a tour circle marker
- **THEN** the map SHALL fly to the tour location and display the tour info component

#### Scenario: Camera offset on mobile

- **WHEN** a tour is selected on a viewport below 600px
- **THEN** the map SHALL fly to the tour location with bottom padding equal to the sheet height

#### Scenario: Camera offset on desktop with side drawer

- **WHEN** a tour is selected on a viewport at or above 600px
- **THEN** the map SHALL fly to the tour location with right padding equal to the side drawer width (400px)
