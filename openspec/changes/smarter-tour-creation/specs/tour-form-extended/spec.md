## MODIFIED Requirements

### Requirement: Season chip selector

The tour form SHALL include season chips (Winter, Spring, Summer, Autumn) supporting
multi-select. While the chips are automatic they SHALL follow the planned date and end date
(Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn; a span selects every season it
touches). The chips SHALL be automatic when the form opens without seasons or with exactly the
dates' seasons, and SHALL stop following the dates once the user taps a chip.

#### Scenario: Multiple seasons selected

- **WHEN** the user taps Winter and Spring chips
- **THEN** both SHALL be highlighted and `seasons` SHALL contain `['winter', 'spring']`

#### Scenario: Toggle season off

- **WHEN** the user taps an already-selected season chip
- **THEN** it SHALL be deselected and removed from the seasons array

#### Scenario: Season from the date

- **WHEN** a new tour gets the planned date 13 March
- **THEN** Spring SHALL be selected without a tap

#### Scenario: A span across seasons

- **WHEN** the dates run from 26 February to 2 March
- **THEN** Winter and Spring SHALL be selected

#### Scenario: The user's choice wins

- **WHEN** the user has tapped a season chip and then changes the date
- **THEN** the seasons SHALL stay as the user set them

## ADDED Requirements

### Requirement: Form order

The tour form SHALL ask where, then what, then when, then who: name, goal, start, end;
activities and grade; planned date with start time, end date and seasons; partners and
visibility; then description, equipment, notes, GPX and attachments.

#### Scenario: Date near the top

- **WHEN** the creation form opens after a goal pick
- **THEN** the date SHALL come right after the activities, before partners and visibility

### Requirement: Grade field

The form SHALL have an optional grade field (at most 20 characters). It SHALL offer the selected
activities' scales as chips — T1–T6 for hiking and trail running; L, WS, ZS, S, SS, AS, EX for
ski touring, splitboarding, ski mountaineering and mountaineering; S0–S5 for mountain biking —
and a tap SHALL set the grade to the chip. Climbing SHALL get an example placeholder instead of
chips. Without a scale the field SHALL stay free text.

#### Scenario: Hiking

- **WHEN** the user selects Hiking
- **THEN** chips T1 to T6 SHALL be offered and tapping T4 SHALL set the grade to "T4"

#### Scenario: Mixed activities

- **WHEN** the user selects Hiking and Mountain biking
- **THEN** both scales SHALL be offered

#### Scenario: Modifiers stay typable

- **WHEN** the user taps ZS and types "-"
- **THEN** the grade SHALL be "ZS-"

### Requirement: Start time

The form SHALL have an optional start time beside the planned date. It SHALL be disabled without
a planned date and cleared with it.

#### Scenario: Clearing the date

- **WHEN** the user clears the planned date
- **THEN** the start time SHALL be cleared too

### Requirement: Start and end suggestions

When the goal is set and the start is empty, the start card SHALL offer up to three one-tap
suggestions: the user's own earlier start for a goal within 300 m, then the public-transport
stops nearest the goal. When the start is set and the end is empty, the end card SHALL offer the
nearest stops other than the start. A suggestion SHALL set the point with the suggestion's name
and look up its height. Suggestions SHALL never block the form; a failed lookup SHALL show none.

#### Scenario: Stop near the Sustenhorn

- **WHEN** the goal is the Sustenhorn and the start is empty
- **THEN** "Steingletscher, Susten" SHALL be offered, and tapping it SHALL set the start there with that name and its height

#### Scenario: Been here before

- **WHEN** the user's earlier tour to the same summit started at "Tierberglihütte SAC"
- **THEN** that start SHALL be offered first

### Requirement: GPX fills empty points

Picking a GPX SHALL set an empty start point to the track's first point and an empty end point to
its last point, or make it a round trip when first and last point lie within 200 m. Set points
and the goal SHALL never change.

#### Scenario: Loop track

- **WHEN** a GPX whose ends are 40 m apart is picked for a tour without start and end
- **THEN** the start SHALL be the first track point and the end SHALL equal the start
