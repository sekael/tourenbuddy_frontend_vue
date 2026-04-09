## ADDED Requirements

### Requirement: Map action overlay exposes a feedback entry point

The map action overlay SHALL render a Feedback floating action button and SHALL emit an `openFeedback` event when the button is activated, without owning any feedback sheet state itself.

#### Scenario: Feedback FAB rendered

- **WHEN** the map action overlay is mounted and the user is not currently picking a location
- **THEN** a Feedback FAB SHALL be rendered alongside the existing profile, contact, and add-tour FABs

#### Scenario: Feedback FAB emits event

- **WHEN** the user taps the Feedback FAB
- **THEN** the overlay SHALL emit the `openFeedback` event
- **AND** the overlay SHALL NOT mutate any local sheet visibility state

### Requirement: Map page owns feedback sheet visibility

The map page SHALL own the visibility state of the Feedback sheet and SHALL render the shared `FeedbackSheet` component in response to the overlay's `openFeedback` event, consistent with how the profile and contact sheets are wired.

#### Scenario: Map page opens feedback sheet

- **WHEN** the map action overlay emits `openFeedback`
- **THEN** the map page SHALL set its `showFeedbackSheet` state to true and render the `FeedbackSheet` component

#### Scenario: Sheet close clears state

- **WHEN** the `FeedbackSheet` emits its close event
- **THEN** the map page SHALL set `showFeedbackSheet` to false and unmount the sheet
