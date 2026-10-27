## MODIFIED Requirements

### Requirement: Start/end point display

The tour info sheet SHALL display start and end points with route icons. When the start point is set without an end point, the sheet SHALL indicate a one-way tour to the goal rather than a round trip. When the end point is set without a start point (a stage connected to the next one), the sheet SHALL display the end row alone.

#### Scenario: Start and end points set

- **WHEN** the tour has both start and end points, more than 10 m apart
- **THEN** they SHALL be displayed as two point rows, each by its name (else its coordinates), with `trip_origin` and `sports_score` icons (see Point icons match the form)

#### Scenario: Only start point (one-way to goal)

- **WHEN** the tour has a start point but null end point
- **THEN** the start row SHALL be displayed, and the end row beside it SHALL read "One-way to goal" with the goal's flag icon — unless the way down is flown, when it SHALL read "not set yet" under the Landing label

#### Scenario: End at the start (round trip)

- **WHEN** the tour's end point is the same place as its start point (within 10 m, as on the map)
- **THEN** the start row SHALL be displayed, and the end row SHALL read "Round trip" without an elevation

#### Scenario: Only end point (connected stage)

- **WHEN** the tour has an end point but null start point
- **THEN** the end point row SHALL be displayed — its name, else its coordinates, with its elevation only alongside a name — and no start row SHALL be displayed

#### Scenario: No start/end points

- **WHEN** both start and end points are null
- **THEN** no start/end point rows SHALL be displayed

### Requirement: Start and end point metadata display

A start or end point row SHALL name the point by its name when it has one, else by its coordinates, and SHALL show the point's elevation beside its name. A point without a name SHALL show no elevation. The end row of a one-way tour or a round trip reads as such instead (see Start/end point display).

#### Scenario: Start point with name and elevation

- **WHEN** the tour has `startPoint`, `startPointName`, and `startPointElevation`
- **THEN** the start point row SHALL display the name and the elevation, without the coordinates

#### Scenario: End point with name only

- **WHEN** the tour has `endPoint` and `endPointName` but null `endPointElevation`
- **THEN** the end point row SHALL display the name, without coordinates or an elevation value

#### Scenario: Point with coordinates only

- **WHEN** a start or end point has null name and null elevation
- **THEN** the row SHALL display only the coordinates (existing behavior preserved)

#### Scenario: Elevation without a name

- **WHEN** a start or end point has an elevation but no name
- **THEN** the row SHALL display the coordinates without the elevation

### Requirement: Route numbers

The tour detail SHALL show the route's climb and descent, and its distance when known, from the most accurate data the tour has, never typed: the distance from a GPX track (horizontal), the climb and descent from the track when it has heights (counted only past a 5 m swing from the last turning point), else from the point heights over the legs the tour has — start → goal and goal → end — counting every rise as climb and every drop as descent, whichever leg it is on. Without a start the start → goal leg is absent, and without an end (it ends at its goal) the goal → end leg is absent; an absent leg, or one missing a height, adds nothing, and the other leg still counts. A 0 SHALL NOT show. No walking time SHALL be estimated.

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

### Requirement: Route numbers per leg

A GPX track with heights SHALL count every rise and drop, a split tour's too, unless a way is
flown whole (a lone glider's way down included): then each walked way SHALL count every rise and drop and each
flown way only its net change (a thermal is neither climb nor extra descent), and the track's
distance SHALL be the walked way's alone, with heights or without — none for a day flown both
ways; point heights count as Route numbers
says. A flown way SHALL show its arrow and its activities' icons, the glider last — the
glider alone for a pure flight. A 0 SHALL NOT show: a tour that ends at its goal shows no "↓ 0 m".

#### Scenario: Hike & fly with a thermal

- **WHEN** a hike & fly track climbs 1000 m on foot and the flight circles 300 m up in a thermal
  before landing 1000 m below the summit
- **THEN** the route SHALL read "↑ 1000 m", a glider with 1000 m, and the walk's distance

#### Scenario: A dip on the walk up

- **WHEN** a hike & fly walk drops 100 m into a col before climbing to the summit
- **THEN** its descent SHALL count those 100 m plus the flight's net drop

#### Scenario: Thermal flight from the valley

- **WHEN** a lone glider flies the way up too, circling in thermals with 100 m of sink to a goal
  1000 m above the start
- **THEN** its climb SHALL read 1000 m, the sink not counted as descent, and no distance SHALL show

#### Scenario: A split tour walked down

- **WHEN** a split tour skis up and hikes down over a 50 m counter-climb
- **THEN** its climb and descent SHALL be the whole track's, the counter-climb included

#### Scenario: One way to a hut

- **WHEN** a stage ends at its goal
- **THEN** its route numbers SHALL show the climb and no "↓ 0 m"

#### Scenario: Ski down to a lower launch, then fly

- **WHEN** a ski & fly tour skis and flies the way down
- **THEN** its descent SHALL read with the arrow, the ski-tour icon and the glider

#### Scenario: An outing with a flown stage

- **WHEN** a two-day outing climbs on foot both days and flies down on the second
- **THEN** its totals SHALL read the climb plain and the descent with the glider
