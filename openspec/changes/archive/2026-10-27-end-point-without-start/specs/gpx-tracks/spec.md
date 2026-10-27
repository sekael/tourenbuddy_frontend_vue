## MODIFIED Requirements

### Requirement: Direction connector for tours without a track

The system SHALL draw, for every shown tour WITHOUT a GPX track (the selected tour, or each segment of a focused outing), a thin, light straight line start → goal → end in the tour's activity marker colours (banded when several), with small arrows evenly spaced on screen along each leg pointing that way. A tour with an end but no start (a stage connected to the next one) SHALL get the single leg goal → end, with one-way arrows. A tour with neither a start nor an end SHALL get no connector.

#### Scenario: Start, goal and distinct end

- **WHEN** a tour without a GPX track and with start, goal and a distinct end is shown
- **THEN** two thin legs start → goal and goal → end appear, each with evenly spaced one-way arrows, and a leg shorter than the spacing has one arrow in its middle

#### Scenario: Round trip

- **WHEN** the tour's end is the same place as its start (within 10 m)
- **THEN** one leg start ↔ goal appears with a two-way arrow (an unsplit tour; a split one draws both legs, each one-way in its own way's colours)

#### Scenario: Coinciding points

- **WHEN** two consecutive points of the tour coincide
- **THEN** the leg between them is dropped

#### Scenario: End without a start

- **WHEN** a stage that had only a goal is connected to the next stage, so it has a goal and an end but no start
- **THEN** one thin leg goal → end appears with one-way arrows, in the tour's activity colours (a split tour's: its way down's)

#### Scenario: Goal only

- **WHEN** a tour without a GPX track has neither a start nor an end
- **THEN** no connector appears

#### Scenario: Outing overview with a hike and a flight

- **WHEN** the overview of an outing with a hiking segment followed by a paragliding segment is open
- **THEN** the first connector is in the hiking colour and the second in the paragliding colour, matching each segment's markers
