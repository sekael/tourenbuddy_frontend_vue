# Spec Delta

## MODIFIED Requirements

### Requirement: Completion toggle control

The tour info sheet SHALL display the completion toggle as an icon toggle at the end of the hero line, next to the visibility toggle. The control SHALL show a filled check-circle when the tour is completed and an empty circle when not, expose its state as a pressed state, and carry a fixed accessible label naming the state it toggles ("Completed") — the pressed state, not a changing label, tells whether it is on. Activation SHALL invoke the tours store `setCompleted` action instantly — no confirmation dialog — for both mark and unmark directions.

#### Scenario: Toggle shown for tour owner

- **WHEN** the info sheet is opened by the tour's owner
- **THEN** the completion toggle control SHALL be visible as an icon toggle in the hero line beside the visibility toggle
- **AND** its visual state SHALL reflect the tour's current `completed` field (filled check-circle if true, empty circle if false)

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

#### Scenario: Toggle is identifiable without a visible text label

- **WHEN** a screen reader focuses the completion toggle of a completed tour
- **THEN** it SHALL announce "Completed" as a pressed toggle button
- **AND** after unmarking, the same label SHALL be announced as not pressed
