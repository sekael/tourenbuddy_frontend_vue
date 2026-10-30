## MODIFIED Requirements

### Requirement: Route numbers

The tour detail SHALL show the route's climb, descent and, when known, distance from the most accurate data, never typed: a tour with a GPX track counts the track — its distance, and climb and descent from its heights (past a 5 m swing from the last turning point), a track without heights taking the terrain's along its line when online. Only a tour without a track, or whose track can't be had, counts the point heights over the legs start → goal and goal → end, every rise as climb and every drop as descent. A leg that is missing or lacks a height adds nothing; the other still counts. While the track loads no numbers SHALL show. A 0 SHALL NOT show. No walking time SHALL be estimated.

#### Scenario: Hut to summit to valley without a track

- **WHEN** a tour starts at a hut at 2632 m, has its goal at 3079 m and ends in the valley at 1822 m
- **THEN** the detail SHALL show a climb of 447 m and a descent of 1257 m and no distance

#### Scenario: Track with heights

- **WHEN** the tour has a GPX track with heights
- **THEN** the detail SHALL show the track's distance, climb and descent instead of the point heights' numbers

#### Scenario: Start height missing

- **WHEN** the tour has a start point without a height, its goal at 3079 m, its end at 1822 m, and no track
- **THEN** the detail SHALL show a descent of 1257 m and no climb

#### Scenario: No start point (connected stage)

- **WHEN** a stage without a start has its goal at 3420 m and ends at a hut at 2795 m
- **THEN** the detail SHALL show a descent of 625 m and no climb, and an outing's totals SHALL include that descent

#### Scenario: Leg running the other way

- **WHEN** a tour starts at 2632 m, its goal lies at 1707 m, and it ends at a viewpoint at 1950 m
- **THEN** the detail SHALL show a descent of 925 m and a climb of 243 m

#### Scenario: Completion or visibility toggled on a tour with a track

- **WHEN** the owner marks a tour with a GPX track completed or toggles its visibility
- **THEN** the detail SHALL keep showing the track's numbers throughout, never falling back to the point heights' numbers while the tour reloads

#### Scenario: Track without heights

- **WHEN** a tour's track was drawn offline or uploaded without heights, and the app is online
- **THEN** the detail SHALL show climb and descent from the terrain's heights along the track, not from the point heights

#### Scenario: Track still loading

- **WHEN** the tour detail opens before its track has loaded
- **THEN** no route numbers SHALL show until the track's are known
