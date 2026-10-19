# Spec Delta

## MODIFIED Requirements

### Requirement: Completion toggle control

The tour info sheet SHALL display the completion toggle as a labelled tonal button in the owner toggles row directly below the hero, beside the visibility toggle. Not completed, it SHALL show an empty circle and the action label "Complete Tour"; completed, a check-circle on a success tint and the label "Completed". It SHALL expose its state as a pressed state. Activation SHALL invoke the tours store `setCompleted` action instantly — no confirmation dialog — for both mark and unmark directions.

#### Scenario: Toggle shown for tour owner

- **WHEN** the info sheet is opened by the tour's owner
- **THEN** the completion toggle control SHALL be visible in the owner toggles row below the hero, beside the visibility toggle
- **AND** its visual state SHALL reflect the tour's current `completed` field (check-circle on a success tint if true, empty circle if false)

#### Scenario: Toggle hidden or disabled for non-owner

- **WHEN** the info sheet is opened by a user who does not own the tour
- **THEN** the completion toggle control SHALL be hidden or rendered as non-interactive (consistent with how edit and delete are gated for non-owners)

#### Scenario: Mark tour completed from info sheet

- **WHEN** the tour is not completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, true)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the completed state

#### Scenario: Unmark tour from info sheet

- **WHEN** the tour is completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, false)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the not-completed state

#### Scenario: Failure surfaced to user

- **WHEN** `setCompleted` fails and rolls back
- **THEN** the toggle control SHALL reflect the original state
- **AND** the error SHALL be surfaced via the existing snackbar/error presentation pattern
