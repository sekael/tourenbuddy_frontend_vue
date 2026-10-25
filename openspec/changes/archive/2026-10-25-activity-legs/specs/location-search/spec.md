## MODIFIED Requirements

### Requirement: Search result names the picked point

When the user confirms within 50 m of the last chosen result, that result's name SHALL be used as the suggested name of the picked point (the tour name for a goal, the start or end point name otherwise) instead of the nearby-name lookup. A confirm while the map is still flying to the chosen result, before the user touched the map, SHALL pick the result itself: its location and its name. Elevation lookup SHALL run unchanged.

#### Scenario: Confirm on the result

- **WHEN** the user chooses "Piz Bernina" and confirms without panning
- **THEN** the tour creation form SHALL be prefilled with the name "Piz Bernina"

#### Scenario: Confirm after moving away

- **WHEN** the user chooses a result, pans more than 50 m away, then confirms
- **THEN** the name SHALL come from the existing nearby-name lookup

#### Scenario: Start point from search

- **WHEN** the user picks a start point by choosing the result "Pontresina" and confirms without panning
- **THEN** the start point name SHALL be "Pontresina"

#### Scenario: Confirm before the flight lands

- **WHEN** the user chooses a landing 165 km away and confirms while the map is still flying there
- **THEN** the landing SHALL be the result's location with the result's name, not a place passed en route
