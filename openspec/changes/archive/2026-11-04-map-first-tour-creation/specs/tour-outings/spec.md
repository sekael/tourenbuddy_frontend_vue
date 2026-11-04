## ADDED Requirements

### Requirement: Lay out stages before the first save

The creation form SHALL offer "+ Next day" after the end point. It SHALL add a stage seeded from the
current one (activities, legs, partners, visibility, seasons), starting at its end (else its goal) with
name and height, dated the day after its last day, and SHALL open the route step for the new stage's
goal. The form SHALL let the user switch between the stages and remove a later stage. One save SHALL
create every stage as a segment of one new outing in order; cancelling SHALL create nothing.

#### Scenario: Three-day trek in one flow

- **WHEN** the user lays out three stages with "+ Next day" and saves once
- **THEN** three tours SHALL be created as segments 1, 2 and 3 of one outing, dated on consecutive days

#### Scenario: Stage with an error

- **WHEN** the user saves while stage 2 has no name
- **THEN** nothing SHALL be saved and stage 2 SHALL show with its name error

#### Scenario: Cancelled layout

- **WHEN** the user cancels after laying out two stages
- **THEN** no tour and no outing SHALL be created

### Requirement: Days in the route step

The route step of a multi-day layout SHALL show the days and SHALL offer "Next day", which keeps the
current day and plans the next from its end without leaving the step. Activities, partners and
visibility set on a day SHALL carry to the later days that had the same value; moving a day's date
SHALL move the later days that followed it.

#### Scenario: Next day from the map

- **WHEN** the user sets day 1's goal and end and taps "Next day"
- **THEN** day 2 SHALL be planned in the same step, starting at day 1's end, dated the day after

#### Scenario: Partner added on day 1

- **WHEN** the user adds a partner on day 1 of three
- **THEN** days 2 and 3 SHALL have the partner too, unless their partners were changed on their own

### Requirement: Split into daily stages

A creation form whose dates span several days, and a saved standalone tour (or an outing's last segment)
of its owner that does, SHALL offer "Split into daily stages". The tour SHALL keep its first day (its
end date cleared on save) and the route step SHALL open for the next day's stage, titled with the day's
place in the span.

#### Scenario: Split while creating

- **WHEN** the user sets 12–14 March in a new tour and taps "Split into daily stages"
- **THEN** the tour SHALL be dated 12 March only and the route step SHALL open for day 2 of 3, dated 13 March

#### Scenario: Split a saved tour

- **WHEN** the owner splits a saved tour dated 12–13 March and saves the day-2 stage
- **THEN** the tour SHALL be dated 12 March as segment 1 and the new stage, dated 13 March, segment 2
