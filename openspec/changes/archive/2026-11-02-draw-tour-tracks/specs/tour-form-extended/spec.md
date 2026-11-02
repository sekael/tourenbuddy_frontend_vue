## MODIFIED Requirements

### Requirement: Form order

The tour form SHALL ask where, then what, then how, then when, then who: name, goal; activities;
the route — track, start, end and grade; planned date with start time, end date and seasons;
partners and visibility; then description, equipment, notes and attachments.

#### Scenario: Date near the top

- **WHEN** the creation form opens after a goal pick
- **THEN** the date SHALL come right after the route's grade, before partners and visibility

#### Scenario: Track before the points

- **WHEN** the creation form opens after a goal pick
- **THEN** the track SHALL come right after the activities, before start and end

## ADDED Requirements

### Requirement: Start and end fold away until set

While a tour has neither start nor end, the form SHALL show them as one row with "Set by hand",
which opens both point sections with their suggestions. A pick, a track or a saved point SHALL show
the sections; removing both points SHALL fold them again.

#### Scenario: New tour

- **WHEN** the creation form opens after a goal pick
- **THEN** start and end SHALL show as one "Set by hand" row, with no pick buttons or suggestions

#### Scenario: Set by hand

- **WHEN** the user taps "Set by hand"
- **THEN** the start and end sections SHALL open as they were before this change

#### Scenario: Drawn track

- **WHEN** the user draws a track from the valley to the goal
- **THEN** the start section SHALL open with the track's first point, named and with its height

#### Scenario: Editing a tour with a start

- **WHEN** the user edits a tour that has a start point
- **THEN** the start and end sections SHALL show open

### Requirement: Points from the track follow it

A start or end the track set SHALL move with the track: a redrawn or replaced track SHALL set it
anew by the "GPX fills empty points" rules, and clear it when the new track ends at the goal. A
point picked, suggested, renamed or saved before SHALL never move. Removing the track SHALL leave
the points.

#### Scenario: Redrawn end

- **WHEN** a drawn track set the end and the user extends the drawing to another valley
- **THEN** the end SHALL move to the new track's last point, with its name and height looked up

#### Scenario: Hand-picked start

- **WHEN** the user picked the start by hand, then draws a track starting elsewhere
- **THEN** the start SHALL stay where it was picked

#### Scenario: Ski route planned as a tour

- **WHEN** the user plans a marked ski route as a tour
- **THEN** start and end SHALL both come from the route's track and show as such

#### Scenario: Redrawn in the middle

- **WHEN** a drawn track set start and end and the user redraws only its middle
- **THEN** start and end SHALL keep their names, with no lookup again

#### Scenario: New track ends at the goal

- **WHEN** a drawn track set the end and the user redraws it to end at the goal
- **THEN** the end SHALL be cleared
