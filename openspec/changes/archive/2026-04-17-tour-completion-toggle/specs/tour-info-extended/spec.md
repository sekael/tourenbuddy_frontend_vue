## ADDED Requirements

### Requirement: Completion toggle control

The tour info sheet SHALL display a rounded checkbox-style toggle control in the bottom-right action row, alongside the existing edit and delete buttons. The control SHALL display a green checkmark when the tour is completed and an empty rounded box when not completed. Activation SHALL invoke the tours store `setCompleted` action instantly — no confirmation dialog — for both mark and unmark directions.

#### Scenario: Toggle shown for tour owner

- **WHEN** the info sheet is opened by the tour's owner
- **THEN** the completion toggle control SHALL be visible in the bottom-right action row beside edit and delete
- **AND** its visual state SHALL reflect the tour's current `completed` field (green checkmark if true, empty rounded box if false)

#### Scenario: Toggle hidden or disabled for non-owner

- **WHEN** the info sheet is opened by a user who does not own the tour
- **THEN** the completion toggle control SHALL be hidden or rendered as non-interactive (consistent with how edit and delete are gated for non-owners)

#### Scenario: Mark tour completed from info sheet

- **WHEN** the tour is not completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, true)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the green checkmark state

#### Scenario: Unmark tour from info sheet

- **WHEN** the tour is completed and the user activates the toggle
- **THEN** the store `setCompleted(tourId, false)` action SHALL be invoked immediately without a confirmation prompt
- **AND** the control SHALL immediately display the empty (not-completed) state

#### Scenario: Failure surfaced to user

- **WHEN** `setCompleted` fails and rolls back
- **THEN** the toggle control SHALL reflect the original state
- **AND** the error SHALL be surfaced via the existing snackbar/error presentation pattern
