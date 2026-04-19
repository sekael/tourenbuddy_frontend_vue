## MODIFIED Requirements

### Requirement: Contacts store

A Pinia store (`useContactsStore`) SHALL manage the list of contacts (including their contact methods) with reactive `contacts`, `isLoading`, and `error` state. When `addContact` is called with a non-empty `phoneNumber`, the store SHALL validate it via `normalizePhone`. If validation fails, the store SHALL surface a validation error (set `error`) and SHALL NOT create a phone contact method. The contact itself MAY still be created without the phone, depending on caller intent (form vs. import; see `contact-device-import`).

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the contacts store SHALL automatically fetch all contacts with their contact methods

#### Scenario: Add contact with valid phone

- **WHEN** `addContact(firstName, lastName?, displayName?, '079 123 45 67')` is called
- **THEN** the store SHALL create the contact, then add a primary phone contact method with `value = '+41791234567'`, add the full contact (with method) to the local list, and re-sort by firstName

#### Scenario: Add contact with invalid phone from manual form

- **WHEN** `addContact(firstName, lastName?, displayName?, '123')` is called from the manual form path
- **THEN** the store SHALL throw a validation error and SHALL NOT create the contact

#### Scenario: Add contact without phone

- **WHEN** `addContact(firstName, lastName?, displayName?)` is called without a phone number
- **THEN** the store SHALL create the contact with empty `contactMethods` array

#### Scenario: Store update reflects in list

- **WHEN** `updateContact` action completes successfully
- **THEN** the local contacts array is updated with the new data and re-sorted by first name

#### Scenario: Store delete reflects in list

- **WHEN** `deleteContact` action completes successfully
- **THEN** the contact is removed from the local contacts array immediately

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the contacts store SHALL clear its cached contacts list

### Requirement: Contact creation dialog

A dialog component SHALL allow users to create new contacts manually or via import. The dialog SHALL have two view states: `form` (default, showing import buttons and manual entry fields) and `import-results` (showing a list of imported contacts). After a successful import, the dialog SHALL switch to the `import-results` view. The manual form SHALL block submission when the phone field is non-empty and `normalizePhone` fails for the entered value, displaying an inline validation error. An empty phone field SHALL remain valid (name-only contacts are allowed).

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

- **WHEN** the user fills in at least the first name and submits from the form view, with phone either empty or in a parseable format
- **THEN** the dialog SHALL call `contactsStore.addContact()` with the normalized E.164 phone (or no phone) and close

#### Scenario: Manual submission with invalid phone blocked

- **WHEN** the user enters a non-empty phone that fails `normalizePhone` and submits
- **THEN** the form SHALL display an inline validation error on the phone field and SHALL NOT submit

#### Scenario: Missing required field

- **WHEN** the user submits without a first name
- **THEN** the form SHALL display a validation error

### Requirement: Edit contact methods

The contact detail view SHALL display all existing contact methods as editable rows. Each row shows the method type (phone/email), value (formatted for display via `formatPhoneForDisplay` for phones), and an optional label. Users SHALL be able to edit the value and label of existing methods. On save of a phone method, the entered value SHALL be validated via `normalizePhone`; if invalid, the form SHALL show an inline error and SHALL NOT persist. If valid, the E.164 form SHALL be persisted via the repository.

#### Scenario: Edit phone number with valid input

- **WHEN** user changes the value of a phone contact method to `'079 123 45 67'` and saves
- **THEN** the method is updated in Supabase via `ContactMethodsRepository.updateMethod()` with `value = '+41791234567'`

#### Scenario: Edit phone number with invalid input blocked

- **WHEN** user changes a phone method value to `'abc'` and attempts to save
- **THEN** the form SHALL show an inline validation error and SHALL NOT call the repository

#### Scenario: Edit method label

- **WHEN** user changes the label of a contact method (e.g., "Mobile" → "Work") and saves
- **THEN** the label is updated in Supabase

#### Scenario: Repair flagged legacy phone

- **WHEN** user opens a contact whose phone method has `isValid = false` and saves a new parseable value
- **THEN** the repository SHALL update `value` to E.164 and set `is_valid = true`

## ADDED Requirements

### Requirement: Live as-you-type phone formatting in manual entry

All manual phone input fields (contact creation dialog, contact detail edit row, add-method form) SHALL apply live as-you-type formatting via the existing `useAsYouTypePhone` composable using default region `CH`. Live formatting is presentation-only; on submit/save the raw input SHALL be passed to `normalizePhone`, and the resulting E.164 form SHALL be persisted.

#### Scenario: Live formatting in contact creation dialog phone field

- **WHEN** the user types digits into the phone field of the contact creation dialog
- **THEN** the visible value SHALL be formatted progressively (e.g. `079 123 45 67`) via `useAsYouTypePhone`

#### Scenario: Live formatting in contact detail edit row

- **WHEN** the user edits a phone method value in the contact detail view
- **THEN** the input field SHALL apply the same live as-you-type formatting

#### Scenario: Live formatting does not affect persisted value

- **WHEN** the user submits a manually entered phone field with a live-formatted value (e.g. `079 123 45 67`)
- **THEN** the persisted `contact_methods.value` SHALL be `+41791234567` (E.164), not the live-formatted display string

### Requirement: Surface invalid legacy phone methods in contact detail

When a contact method has `isValid === false`, the contact detail view SHALL display a visible warning indicator on that method row prompting the user to fix it. The original raw value SHALL be shown so the user has context for repair.

#### Scenario: Legacy invalid phone shown with warning

- **WHEN** the contact detail view renders a phone method with `isValid = false` and `value = 'ext. 1234'`
- **THEN** the row SHALL display the raw value alongside a warning icon and a hint to fix the number
