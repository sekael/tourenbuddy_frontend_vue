## ADDED Requirements

### Requirement: Legs at a glance

A split tour SHALL show its way-up activities after an up arrow and its way-down activities after
a down arrow in the detail and on stage cards, and its activity disc SHALL lead with the way up.
When the way down is flown, the end point SHALL read as the landing.

#### Scenario: Climb & fly detail

- **WHEN** a tour climbs up and flies down
- **THEN** the detail SHALL read "↑ Climbing ↓ Paragliding" and the end row SHALL be named "Landing"

### Requirement: Route numbers per leg

A split tour's route numbers SHALL count the climb on the way up only. When the whole way down is
flown, the descent SHALL be the flight's net drop, and a GPX track's distance SHALL be the way
up's alone. A flown way SHALL show its arrow and its activities' icons, the glider last — the
glider alone for a pure flight. A tour that ends at its goal SHALL show no descent.

#### Scenario: Hike & fly with a thermal

- **WHEN** a hike & fly track climbs 1000 m on foot and the flight circles 300 m up in a thermal
  before landing 1000 m below the summit
- **THEN** the route SHALL read "↑ 1000 m", a glider with 1000 m, and the walk's distance

#### Scenario: One way to a hut

- **WHEN** a stage ends at its goal
- **THEN** its route numbers SHALL show the climb and no "↓ 0 m"

#### Scenario: Ski down to a lower launch, then fly

- **WHEN** a ski & fly tour skis and flies the way down
- **THEN** its descent SHALL read with the arrow, the ski-tour icon and the glider

#### Scenario: An outing with a flown stage

- **WHEN** a two-day outing climbs on foot both days and flies down on the second
- **THEN** its totals SHALL read the climb plain and the descent with the glider
