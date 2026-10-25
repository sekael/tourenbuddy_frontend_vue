## ADDED Requirements

### Requirement: Activity type chip selector

The tour form (create, edit and suggest) SHALL show one chip per activity type supporting multi-select: tapping an unselected chip adds that type, tapping a selected chip removes it. Zero, one or several types MAY be selected. The saved list SHALL follow the chips' display order, regardless of the order in which they were tapped.

#### Scenario: Select two activities

- **WHEN** the user taps Hiking and then Ski Tour and saves
- **THEN** the tour SHALL be saved with both types, Ski Tour first (display order)

#### Scenario: Deselect an activity

- **WHEN** the user taps an already-selected activity chip
- **THEN** that type SHALL be removed and the other selected types SHALL stay selected

#### Scenario: Clear every activity

- **WHEN** the user deselects every activity chip and saves
- **THEN** the tour SHALL be saved with no activity type

#### Scenario: Edit form shows saved activities

- **WHEN** the user opens the edit form of a tour with several types
- **THEN** every saved type's chip SHALL be shown selected
