## MODIFIED Requirements

### Requirement: Tour filters

The overlay SHALL expose filters for partner, activity type, grade, season, planned-date range, and completion status, and on the Friends tab also for the friend who recorded the tour. A tour SHALL appear in the filtered list only when it satisfies every active filter (logical AND across filter categories). When no filters are active, all tours SHALL pass.

#### Scenario: Partner filter

- **WHEN** on the My Tours tab the partner filter holds a set of one or more contact IDs
- **THEN** a tour SHALL match only when `tour.partnerIds` intersects the selected set (at least one partner in common)

#### Scenario: Partner filter on the Friends tab

- **WHEN** on the Friends tab the partner filter holds one or more people
- **THEN** a friend tour SHALL match only when at least one of them is among its registered partners
- **AND** a tour whose partners are withheld from the viewer (the viewer is not a partner on it) SHALL NOT match

#### Scenario: Recorded-by filter

- **WHEN** on the Friends tab the recorded-by filter holds one or more friends
- **THEN** a tour SHALL match only when one of them recorded (owns) it

#### Scenario: Recorded-by filter absent on My Tours

- **WHEN** the My Tours tab is active
- **THEN** the filter panel SHALL NOT offer the recorded-by filter

#### Scenario: Activity-type filter

- **WHEN** the activity-type filter holds one or more `TourType` values
- **THEN** a tour SHALL match only when at least one of its activity types is among the selected values; a tour with no type SHALL NOT match

#### Scenario: Multi-activity tour matches any of its types

- **WHEN** the activity-type filter holds only `hiking` and a tour has types `skitour` and `hiking`
- **THEN** the tour SHALL match

#### Scenario: Grade filter

- **WHEN** the grade filter holds the range T2–T4
- **THEN** tours graded T2, T3 or T4 SHALL match
- **AND** tours graded T5, tours graded only on another scale, and ungraded tours SHALL NOT match

#### Scenario: Season filter

- **WHEN** the season filter holds one or more `Season` values
- **THEN** a tour SHALL match only when `tour.seasons` is non-null and intersects the selected set

#### Scenario: Planned-date range filter uses span overlap

- **WHEN** the user sets a `from` date, a `to` date, or both
- **THEN** a tour SHALL match only when `tour.plannedDate` is non-null and the tour's span —
  `plannedDate` through `endDate`, or `plannedDate` alone when `endDate` is null — intersects
  the inclusive filter range; tours with `plannedDate === null` SHALL be excluded

#### Scenario: Multi-day tour straddling the filter boundary

- **WHEN** a tour runs 25–27 August and the filter range is 26–30 August
- **THEN** the tour SHALL match, even though its planned (start) date lies before `from`

#### Scenario: Multi-day tour entirely outside the range

- **WHEN** a tour runs 1–3 August and the filter range is 26–30 August
- **THEN** the tour SHALL NOT match

#### Scenario: Planned-date filter inactive

- **WHEN** both `from` and `to` are empty
- **THEN** the planned-date filter SHALL NOT exclude any tour, including tours with `plannedDate === null`

#### Scenario: Completion-status filter tri-state

- **WHEN** the completion filter is `all`
- **THEN** no tour SHALL be excluded by this filter
- **WHEN** the filter is `done`
- **THEN** only tours with `completed === true` SHALL match
- **WHEN** the filter is `open`
- **THEN** only tours with `completed === false` SHALL match

#### Scenario: Filters combine with search

- **WHEN** a search query and one or more filters are active
- **THEN** a tour SHALL appear only when it satisfies both the search predicate and every active filter

## ADDED Requirements

### Requirement: Grade filter

The grade filter SHALL offer one chip row per closed grade scale — SAC hiking T1–T6, SAC alpine L–EX, singletrail S0–S5 — and SHALL hold at most one inclusive range per scale. A tour SHALL match when at least one part of its grade lies on a filtered scale and every such part lies within that scale's range. A part SHALL count as the scale grade it leads with, so a modifier keeps its base grade.

#### Scenario: Modifier keeps its base grade

- **WHEN** the grade filter holds the range WS–ZS
- **THEN** tours graded "WS-", "ZS+" or "ZS+ (III)" SHALL match
- **AND** a tour graded "S-" SHALL NOT match

#### Scenario: Free-text grade never matches a range

- **WHEN** any grade range is active
- **THEN** a tour graded only in free text outside the closed scales (e.g. "5c", "6a+") SHALL NOT match

#### Scenario: Every filtered part must fit

- **WHEN** the grade filter holds T1–T3 and a tour is graded "S2, T4"
- **THEN** the tour SHALL NOT match
- **WHEN** the grade filter holds S0–S2 only and a tour is graded "S2, T4"
- **THEN** the tour SHALL match

#### Scenario: Picking a range

- **WHEN** no grade of a scale is selected and the user taps T2
- **THEN** the range SHALL be T2 alone
- **WHEN** the user then taps T4
- **THEN** the range SHALL become T2–T4 and T2, T3 and T4 SHALL show as selected
- **WHEN** the user then taps any chip of that scale
- **THEN** the range SHALL restart at that chip alone

#### Scenario: Clearing a scale

- **WHEN** a scale's range is a single grade and the user taps that grade again
- **THEN** that scale SHALL have no range, and other scales' ranges SHALL be unchanged

#### Scenario: Only scales in use are offered

- **WHEN** the active tab's tours carry grades on the hiking scale only
- **THEN** the grade filter SHALL offer the hiking row alone
- **AND** a scale holding an active range SHALL stay offered even when no tour uses it
- **AND** when no tour carries a closed-scale grade and no range is active, the grade filter SHALL NOT be shown

#### Scenario: Grade counts as one filter

- **WHEN** ranges are active on two scales
- **THEN** the filters badge SHALL count the grade filter once

### Requirement: People filters on the Friends tab

On the Friends tab the recorded-by chips SHALL be the friends who recorded at least one of the tab's tours, named as the viewer saved them in their contacts, and the partner chips SHALL be the registered partners named on the tab's tours, the viewer shown as "Me". A person selected in either filter SHALL stay offered while selected. Chip labels SHALL render once in final form; the chips SHALL be ordered by label, "Me" first.

#### Scenario: Friend without tours stays clearable

- **WHEN** the recorded-by filter holds a friend who recorded none of the tab's tours
- **THEN** that friend's chip SHALL still be shown, selected, so it can be cleared

#### Scenario: Viewer's own partner entry

- **WHEN** the viewer is a partner on at least one friend tour
- **THEN** the Friends tab partner chips SHALL include a "Me" chip, and selecting it SHALL keep exactly the friend tours the viewer is a partner on

### Requirement: A narrowed Friends list says what the map marks

While search or filters narrow the Friends tab and the map marks fewer of the listed tours than the list holds — the map marks only friend tours the viewer is a partner on — the list SHALL state above its rows how many of them the map shows, and why.

#### Scenario: Fewer marked than listed

- **WHEN** the Friends tab is narrowed to a friend's 43 tours and the viewer is a partner on 5 of them
- **THEN** the list SHALL say that only 5 of these are on the map, the ones the viewer is a partner on

#### Scenario: Nothing to explain

- **WHEN** every listed friend tour is marked on the map, or nothing narrows the list, or the My Tours tab is active
- **THEN** no such note SHALL be shown

### Requirement: Filter panel scroll ends with its content

While the filter panel is open over a list taller than the panel's content, the list region SHALL extend no further than that content, so scrolling ends at the last filter group with no blank space beyond it. Collapsing the panel SHALL restore the list at full length. The sheet SHALL NOT shrink while the panel is open.

#### Scenario: Long list under the open panel

- **WHEN** the panel is open over a list far taller than the panel and the user scrolls down
- **THEN** scrolling SHALL stop once the last filter group is fully shown

#### Scenario: Short list under the open panel

- **WHEN** the panel's content is taller than the list region
- **THEN** the panel SHALL scroll within the region as before

#### Scenario: Collapse restores the list

- **WHEN** the user collapses the panel
- **THEN** every listed row SHALL be reachable by scrolling again
