## ADDED Requirements

### Requirement: Grade and start time in the details

The tour details SHALL show the grade beside the activities and the start time after the planned
date. List rows and outing stage cards SHALL show the grade with the activities. Nothing SHALL be
shown for a missing grade or time.

#### Scenario: Graded tour with a start time

- **WHEN** a ski tour has grade "WS+", date 13 March 2027 and start time 06:30
- **THEN** the details SHALL read the activity with "WS+" and the date with "06:30"

#### Scenario: Stage card

- **WHEN** a stage has activity ski tour and grade "ZS"
- **THEN** its card SHALL read "Ski tour · ZS" before the date
