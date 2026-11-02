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
