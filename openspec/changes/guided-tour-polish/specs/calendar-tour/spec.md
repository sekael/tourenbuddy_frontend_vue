## MODIFIED Requirements

### Requirement: Guided calendar step sequence

The calendar tour SHALL present four steps in order, each spotlighting the real control with an explanatory popover: (1) day-chip meaning — a demo cell showing a fake tour chip and a fake friend chip, then the opened day-detail overview for that same date showing the tour and friend entries; (2) edit availability — the availability edit entry control, whose copy also points to calendar sync in the profile; (3) jump to today — the planned/calendar navigation tab, explaining that tapping it again scrolls back to today; (4) seasonal overview — navigating to and displaying the seasons view. The day-chip step SHALL spotlight the demo calendar cell as an intermediate waypoint, open that day's detail overview, and then spotlight the detail overview with the explanatory popover. Leaving the day-chip step SHALL close the day-detail overview. The seasonal-overview step SHALL actuate the seasons navigation control (spotlighting it with a short hint) and switch the calendar to the seasons view before spotlighting the seasonal overview content. The calendar tour SHALL use the same continuous motion as the onboarding tour.

#### Scenario: Day-chip step opens detail overview

- **WHEN** the calendar tour reaches the day-chip step
- **THEN** the demo calendar cell is spotlighted with a hint, that day's detail overview opens, and the detail overview showing the demo tour and friend entries is spotlighted with the explanatory popover

#### Scenario: Availability edit step

- **WHEN** the calendar tour reaches the availability step
- **THEN** the day-detail overview is closed and the availability edit control is spotlighted with an explanatory popover

#### Scenario: Jump-to-today step

- **WHEN** the calendar tour reaches the jump-to-today step
- **THEN** the calendar is on the planned view and its navigation tab is spotlighted with an explanatory popover

#### Scenario: Seasonal overview step switches the view

- **WHEN** the calendar tour reaches the seasonal-overview step
- **THEN** the seasons navigation control is spotlighted with a hint, the calendar switches to the seasons view, a demo season bar is rendered so the seasonal axis is populated (rather than the zero-tour "no tours" disclaimer), and the seasonal overview content is spotlighted with an explanatory popover

#### Scenario: Cleanup returns to the planned view

- **WHEN** the calendar tour ends by any exit path (finish, dismiss, advancing past the last step, navigation away)
- **THEN** the calendar is left on the planned view and the demo season bar is no longer rendered

#### Scenario: Advancing past the final calendar step

- **WHEN** the user advances past the final calendar step
- **THEN** the calendar tour ends and is marked completed

#### Scenario: Target element is missing

- **WHEN** a calendar step's target element cannot be found in the DOM
- **THEN** the tour skips that step rather than highlighting an empty region or erroring
