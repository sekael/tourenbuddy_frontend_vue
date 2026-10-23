## ADDED Requirements

### Requirement: Grade and start time are suggestable

A partner SHALL be able to suggest a grade (logical field `grade`) and a start time as part of
the `dates` field (`startTime`: the time, `null` to remove the owner's, absent when untouched).
Accepting SHALL write them; a `dates` value without `startTime` SHALL keep the tour's time. A
grade or start-time change SHALL notify partners like any meaningful change.

#### Scenario: Suggesting a grade

- **WHEN** a partner changes the grade from "WS" to "ZS" in the suggest form and sends it
- **THEN** one `grade` suggestion SHALL be created with the new value and the owner SHALL see it in the review sheet

#### Scenario: A pending date suggestion from before start times

- **WHEN** a `dates` suggestion created before start times existed is reviewed on a tour without a start time
- **THEN** it SHALL not be marked stale

#### Scenario: The owner set a time after the suggestion

- **WHEN** a `dates` suggestion without a start time is accepted on a tour that has one
- **THEN** the tour SHALL keep its start time
