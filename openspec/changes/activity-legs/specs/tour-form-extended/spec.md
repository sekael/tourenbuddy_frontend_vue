## ADDED Requirements

### Requirement: Way up and way down in the form

With two or more activities selected, the form SHALL let the user set each activity to up, both
or down. Untouched activities SHALL default to both, except paragliding with others (paragliding
down, the others up) and, without paragliding, hiking with mountain biking (the bike down, the
others up). All activities on both legs SHALL save as an unsplit tour.

#### Scenario: Hike & fly in two taps

- **WHEN** the user selects hiking and paragliding
- **THEN** hiking SHALL be set to up and paragliding to down without further taps

#### Scenario: Hike & bike carried up

- **WHEN** the user selects hiking and mountain biking
- **THEN** hiking SHALL be set to up and mountain biking to down, and the tour SHALL save them so


#### Scenario: The landing

- **WHEN** the way down is paragliding only
- **THEN** the end point SHALL be labelled as the landing

### Requirement: The picker saves what it shows

The form SHALL NOT offer a way that leaves a leg without activity. An activity removed and added
back SHALL return to its way; a removal that leaves a leg empty SHALL show, and save, the defaults.

#### Scenario: No way without activity

- **WHEN** hiking goes up and mountain biking is the only activity on the way down
- **THEN** mountain biking's "up" SHALL be unavailable, and reopening the saved tour SHALL show the same ways

### Requirement: Distance from the goal

The form SHALL show how far the start and end points lie from the goal, as a warning past 20 km.

#### Scenario: A landing in the wrong valley

- **WHEN** the landing picked from the search is a commune centre 50 km from the goal
- **THEN** the landing row SHALL warn with that distance

### Requirement: A lone glider's climb

With paragliding as the only activity, the form SHALL offer "down" (on foot or by lift to the
launch at the goal, the default, saved unsplit) or "both" (flown from the start in thermals,
saved as paragliding on both legs).

#### Scenario: Thermal flight from the valley

- **WHEN** the user plans a flight from the valley, climbing in thermals to the goal and landing below
- **THEN** choosing "both" SHALL save the climb as flown, and the detail SHALL read "↑ [glider]" and "↓ [glider]"
