## ADDED Requirements

### Requirement: Outing chains on the map

Whenever at least two segments of one of the user's outings are on the map and no tour or
outing is open (an open one has the map to itself), the map SHALL draw a dotted, visibly bowed arc from each segment's goal to the next segment's
goal, beneath the markers, so that the chain reads as one outing without opening it, and never as
the route itself (which a straight line between goals would suggest). The open
outing SHALL show its segment tracks and numbered markers instead of the chain line. Chain lines
SHALL NOT be interactive and SHALL NOT affect clustering.

#### Scenario: Unopened outing shows its chain

- **WHEN** the map shows the three segments of "Piz Bernina Hike & Fly" and no outing is open
- **THEN** dotted arcs SHALL run from segment 1's goal to segment 2's goal and on to segment 3's goal
- **AND** each segment's label SHALL name its stage ("Etappe 1/3", "Etappe 2/3", "Etappe 3/3")

#### Scenario: Open outing hides its chain

- **WHEN** the user opens that outing's overview
- **THEN** its chain line SHALL NOT be drawn while its tracks and numbered markers are shown

#### Scenario: Open tour hides every chain

- **WHEN** the user opens any tour's detail
- **THEN** no chain line SHALL be drawn until it closes

#### Scenario: Single standalone tour

- **WHEN** a tour is not part of an outing
- **THEN** no chain line SHALL touch it
