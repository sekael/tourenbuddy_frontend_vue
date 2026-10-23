## ADDED Requirements

### Requirement: Way up and way down in the form

With two or more activities selected, the form SHALL let the user set each activity to up, both
or down. Untouched activities SHALL default to both, except when paragliding is combined with
other activities: paragliding SHALL default to down and the others to up. All activities on both
legs, or a leg without activity, SHALL save as an unsplit tour.

#### Scenario: Hike & fly in two taps

- **WHEN** the user selects hiking and paragliding
- **THEN** hiking SHALL be set to up and paragliding to down without further taps

#### Scenario: Hike & bike carried up

- **WHEN** the user selects hiking and mountain biking and sets hiking to up and mountain biking to down
- **THEN** the tour SHALL save hiking as the way up and mountain biking as the way down

#### Scenario: The landing

- **WHEN** the way down is paragliding only
- **THEN** the end point SHALL be labelled as the landing
