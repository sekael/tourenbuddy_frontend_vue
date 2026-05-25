## ADDED Requirements

### Requirement: Attachments section in tour form

The tour creation/edit form SHALL include an "Attachments" section allowing the user to add, delete, and reorder up to 5 attachments (png/jpeg/pdf, ≤10 MB each) for the tour.

#### Scenario: Add attachment from form

- **WHEN** the user taps the add-attachment control and selects a valid file
- **THEN** the file SHALL be uploaded and SHALL appear in the section as a thumbnail/row with filename

#### Scenario: Delete from form

- **WHEN** the user taps the delete control on an attachment row
- **THEN** the attachment SHALL be removed from the list and from storage

#### Scenario: Reorder from form

- **WHEN** the user drags an attachment row to a new position
- **THEN** the new order SHALL persist after the form is closed and reopened

#### Scenario: Limit reached in form

- **WHEN** the tour already has 5 attachments
- **THEN** the add control SHALL be disabled with a user-visible explanation

#### Scenario: Invalid file in form

- **WHEN** the user selects a file that is too large or of disallowed type
- **THEN** an inline error SHALL be shown AND no upload SHALL occur

#### Scenario: Available during create

- **WHEN** the user is creating a new tour (no `tour_id` yet)
- **THEN** the attachments section SHALL be available and uploads SHALL associate with the tour upon save (or be deferred until the tour row exists, per implementation)
