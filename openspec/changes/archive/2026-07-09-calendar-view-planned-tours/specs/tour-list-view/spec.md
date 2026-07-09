## ADDED Requirements

### Requirement: Calendar entry point in the tour list

The tour-list overview SHALL provide a calendar icon button in its header that
navigates the user to the `/calendar` calendar view.

#### Scenario: Opening the calendar from the tour list

- **WHEN** the user taps the calendar icon button in the tour-list header
- **THEN** the app navigates to the `/calendar` route and displays the calendar
  view

#### Scenario: Calendar button available regardless of active list tab

- **WHEN** the tour list is on either the Owned or the Friends tab
- **THEN** the calendar icon button remains visible and functional in the header
