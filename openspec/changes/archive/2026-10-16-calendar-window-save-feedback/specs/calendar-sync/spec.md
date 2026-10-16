# Spec Delta

## ADDED Requirements

### Requirement: Availability window save reflects pending changes

The availability-window form SHALL enable its save action only while the form differs from the saved settings. After a successful save it SHALL show a clear, accessible confirmation that the new settings were applied, kept until the user changes the form again.

#### Scenario: No pending changes

- **WHEN** the window form shows exactly the saved settings
- **THEN** the save button SHALL be disabled

#### Scenario: Pending changes

- **WHEN** the user changes the start, end or minimum free block
- **THEN** the save button SHALL be enabled

#### Scenario: Reverting an edit

- **WHEN** the user changes a value and then changes it back to the saved value
- **THEN** the save button SHALL be disabled again

#### Scenario: Successful save is confirmed

- **WHEN** the user saves changed settings and the save succeeds
- **THEN** the button SHALL show a "Saved" confirmation, be disabled, and the confirmation SHALL be announced to assistive technology

#### Scenario: Confirmation clears on the next edit

- **WHEN** the "Saved" confirmation is shown and the user changes a value
- **THEN** the button SHALL return to an enabled "Save"

#### Scenario: Failed save

- **WHEN** saving fails (invalid window or network error)
- **THEN** no "Saved" confirmation SHALL be shown and the button SHALL stay enabled
