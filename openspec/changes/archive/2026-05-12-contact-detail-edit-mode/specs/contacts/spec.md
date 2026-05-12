## ADDED Requirements

### Requirement: Contact detail view has view and edit modes

The contact detail view SHALL default to a read-only view mode that displays name, every contact method (with primary-phone highlighting), and the friendship icon if applicable, mirroring the view/edit pattern used by `tour-info-sheet`. The view mode SHALL expose an Edit action that switches the view into edit mode.

Edit mode SHALL aggregate the editable fields — first name, last name, display name, each contact-method value/label row, the primary-phone selector, and the add-new-method sub-form — into a single editable form with one Save and one Cancel control. The per-row inline save buttons SHALL NOT appear in edit mode.

Save SHALL persist every dirty field. If any persistence call fails, the view SHALL remain in edit mode and SHALL surface the failure as a field-level error (for the failing row) or a form-level error (for the name block / add-method block). Cancel SHALL revert all pending values to the contact's currently persisted state and return the view to view mode.

#### Scenario: View mode is the default

- **WHEN** a contact is opened from the contacts list
- **THEN** the detail view SHALL render in view mode with read-only name, methods, and friendship icon, and SHALL display an Edit action

#### Scenario: Edit action enters edit mode

- **WHEN** the user activates Edit
- **THEN** the view SHALL switch to edit mode exposing input controls for name fields, each contact-method row, the primary selector, and the add-method sub-form, plus Save and Cancel actions

#### Scenario: Save persists every dirty field

- **WHEN** the user has changed name fields and/or one or more contact methods and activates Save
- **THEN** the view SHALL invoke the store actions that persist each changed field, and on success SHALL return to view mode displaying the persisted data

#### Scenario: Save fails — stay in edit mode

- **WHEN** the user activates Save and at least one persistence call fails
- **THEN** the view SHALL stay in edit mode, SHALL surface the failure inline next to the offending field (or as a form-level error if not field-attributable), and SHALL NOT discard the user's pending input

#### Scenario: Cancel reverts pending edits

- **WHEN** the user activates Cancel after typing into one or more fields
- **THEN** all input controls SHALL revert to the contact's last persisted values and the view SHALL return to view mode

#### Scenario: Add-method draft discarded on cancel

- **WHEN** the user has typed into the add-method sub-form and then activates Cancel
- **THEN** the draft method SHALL be discarded and SHALL NOT be persisted

## MODIFIED Requirements

### Requirement: Contact detail view primary phone selection

The contact detail view SHALL render every phone method with a primary indicator. In view mode the primary indicator SHALL be read-only. In edit mode the primary indicator SHALL be an interactive selector; selecting a non-primary phone as primary SHALL be applied as part of the single Save action so the store updates the invariant and the view re-renders with the new primary first.

#### Scenario: Toggle primary between two existing phones — success

- **WHEN** the contact has two phone methods and, in edit mode, the user selects the currently non-primary phone's primary control and activates Save
- **THEN** the store SHALL call `setPrimaryPhone(contactId, newPrimaryId)` and, after the repository call succeeds, the selected phone SHALL have `isPrimary: true` while the other has `isPrimary: false`

#### Scenario: Toggle primary fails — stay in edit mode

- **WHEN** the user selects a non-primary phone as primary in edit mode and the `setPrimaryPhone` repository call rejects during Save
- **THEN** the view SHALL stay in edit mode, the previously primary phone SHALL remain primary in the store and in the DB, and the failure SHALL be surfaced inline

#### Scenario: Add a new phone — default not primary when primary exists

- **WHEN** the user adds a phone method to a contact that already has a primary phone
- **THEN** the new phone SHALL be inserted with `isPrimary: false` and the existing primary SHALL remain

#### Scenario: Add the first phone — auto primary

- **WHEN** the user adds a phone method to a contact with zero existing phones
- **THEN** the new phone SHALL be inserted with `isPrimary: true`

#### Scenario: Remove the current primary phone

- **WHEN** the user removes the phone method currently marked primary and other phone methods remain
- **THEN** the store SHALL mark the next remaining phone (by insertion order) as primary via `setPrimaryPhone`

#### Scenario: Primary selector inert in view mode

- **WHEN** the detail view is in view mode
- **THEN** the primary indicator SHALL be visually present but SHALL NOT respond to taps and SHALL NOT call `setPrimaryPhone`
