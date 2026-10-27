## MODIFIED Requirements

### Requirement: Opening a tour frames its points in the visible map

Opening a tour's detail (from a marker or the tour list) SHALL move the camera so the tour's points fill the map area not covered by the bottom sheet (mobile, at its resting height) or the side drawer (desktop): a lone goal is centred there at zoom 12; otherwise the goal and whichever of the start and end points the tour has are all shown. Framing several points SHALL NOT zoom in beyond zoom 12, and SHALL keep the map's bearing.

#### Scenario: Round trip

- **WHEN** a tour's end point is the same place as its start point (within 10 m)
- **THEN** the camera frames its start and goal

#### Scenario: Goal only on a phone

- **WHEN** a tour with only a goal opens in the bottom sheet
- **THEN** the goal sits centred in the map area above the sheet

#### Scenario: End without a start

- **WHEN** a stage connected to the next one, with a goal and an end but no start, opens
- **THEN** the camera frames its goal and its end
