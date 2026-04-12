## MODIFIED Requirements

### Requirement: Contact creation dialog

A dialog component SHALL allow users to create new contacts manually or via import. The dialog SHALL have two view states: `form` (default, showing import buttons and manual entry fields) and `import-results` (showing a list of imported contacts). After a successful import, the dialog SHALL switch to the `import-results` view.

#### Scenario: Default view shows form

- **WHEN** the contact creation dialog opens
- **THEN** the dialog SHALL display import buttons and manual entry fields (first name, last name, display name, phone number)

#### Scenario: Switch to import results after file import

- **WHEN** the user imports contacts via a .vcf file
- **THEN** the dialog SHALL replace the form with a scrollable list of import results showing each contact's name, phone number (if present), and status (imported or skipped)

#### Scenario: Switch to import results after Contact Picker import

- **WHEN** the user imports contacts via the Contact Picker API
- **THEN** the dialog SHALL replace the form with a scrollable list of import results

#### Scenario: Import results show skipped contacts

- **WHEN** contacts are skipped during import due to duplicates
- **THEN** the skipped contacts SHALL appear in the results list with a visual "skipped" indicator distinguishing them from successfully imported contacts

#### Scenario: Return to manual entry from import results

- **WHEN** the user is viewing import results and taps "Add another manually"
- **THEN** the dialog SHALL switch back to the form view with all fields cleared

#### Scenario: Close from import results

- **WHEN** the user is viewing import results and taps "Done"
- **THEN** the dialog SHALL close

#### Scenario: Valid manual submission

- **WHEN** the user fills in at least the first name and submits from the form view
- **THEN** the dialog SHALL call `contactsStore.addContact()` and close

#### Scenario: Missing required field

- **WHEN** the user submits without a first name
- **THEN** the form SHALL display a validation error
