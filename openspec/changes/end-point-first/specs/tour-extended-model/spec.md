## MODIFIED Requirements

### Requirement: Start and end points

The tour schema SHALL include `startPoint` and `endPoint` (each an object with lng/lat, nullable), each with an optional `…Name` (string) and `…Elevation` (integer metres) filled from the Swisstopo services when the point is set. Either point MAY be set without the other.

#### Scenario: Start point without end point

- **WHEN** a tour has `startPoint` set but `endPoint` is null
- **THEN** the tour SHALL be treated as one-way to the goal (it ends at the goal) at the presentation layer

#### Scenario: End point without start point

- **WHEN** a tour has `endPoint` set but `startPoint` is null (a flight from the goal to its landing, or a stage connected to the next one)
- **THEN** the end point SHALL be kept and presented on its own, and the missing start SHALL get nothing — no start marker, no start → goal leg, so nothing climbed or descended before the goal in the route numbers — never a position borrowed from the goal or the end

#### Scenario: Both points set

- **WHEN** a tour has both `startPoint` and `endPoint` set
- **THEN** both SHALL be parsed as `{ lng: number, lat: number }` objects
