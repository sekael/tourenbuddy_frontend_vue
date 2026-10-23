## ADDED Requirements

### Requirement: Grade and start time

A tour SHALL hold an optional grade (trimmed text, at most 20 characters) and an optional start
time (only together with a planned date); `TourDraft` SHALL carry `grade` and `startTime`
("HH:MM"). Friends who are not partners SHALL NOT see the start time, like the planned date.

#### Scenario: Created with both

- **WHEN** a tour is created with grade "ZS-" and start time 06:30 on 13 March
- **THEN** it SHALL read back with grade "ZS-" and start time "06:30"

### Requirement: Older clients never wipe grade or start time

On update, an omitted grade or start time (null) SHALL keep the stored value and an empty string
SHALL clear it, so an older client or a queued older draft never wipes what it doesn't know.

#### Scenario: An older client edits a graded tour

- **WHEN** a tour has grade "ZS-" and start time 06:30 and a client that doesn't know these fields saves an edit
- **THEN** the grade and start time SHALL stay

#### Scenario: Clearing the grade

- **WHEN** the owner empties the grade field and saves
- **THEN** the tour SHALL have no grade

#### Scenario: Grade too long

- **WHEN** a write carries a grade longer than 20 characters
- **THEN** the database SHALL reject it

#### Scenario: Friend without partnership

- **WHEN** a friend who is not a partner reads a friends-visible tour with a start time
- **THEN** the start time SHALL be null for them, like the planned date
