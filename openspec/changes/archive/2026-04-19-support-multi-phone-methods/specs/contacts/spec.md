## ADDED Requirements

### Requirement: Primary phone highlighted with star icon

Any UI element that renders one or more phone methods of a contact (contacts list row subtitle, contact detail phone rows, contact chip, import-results row) SHALL highlight the primary phone with a filled Material Symbols `star` icon adjacent to the phone value. Non-primary phones SHALL NOT display the star icon. In form controls where the user picks the primary, the primary selector SHALL use a `star` glyph (filled when selected, outlined when not) so the picker matches the read-only highlight.

#### Scenario: Primary phone shows filled star

- **WHEN** a phone method with `isPrimary: true` is rendered in any surface
- **THEN** a filled `star` Material Symbols icon SHALL appear adjacent to the phone value

#### Scenario: Non-primary phone has no star

- **WHEN** a phone method with `isPrimary: false` is rendered
- **THEN** no star icon SHALL appear on that row

#### Scenario: Primary selector uses star icon

- **WHEN** the contact form or contact detail view renders the primary-selection control on a phone row
- **THEN** the control SHALL display a `star` icon — filled when that row is the selected primary, outlined when it is not

### Requirement: Phone methods rendered primary-first

Anywhere the app renders a contact's phone methods — contact list subtitle, contact chip, contact detail view, import-results row — the primary phone SHALL be shown first. A shared helper `orderedPhoneMethods(contact)` SHALL return phone methods with the primary first and the remaining in insertion order.

#### Scenario: Detail view lists primary phone first

- **WHEN** a contact with three phone methods is opened in the detail view
- **THEN** the phone method with `isPrimary: true` SHALL render at the top of the phones list

#### Scenario: List subtitle uses primary phone

- **WHEN** the contacts list renders a row for a contact with multiple phones
- **THEN** the subtitle SHALL show the primary phone's value

### Requirement: Manual contact form supports multiple phones

The contact creation form SHALL render a dynamic list of phone rows (value + optional label + primary radio). Users SHALL be able to add and remove phone rows. When more than one phone row has a non-empty value, exactly one row SHALL be selected as primary before the form can be submitted. When only one phone row has a non-empty value, that row SHALL be treated as primary implicitly.

#### Scenario: Add a second phone row

- **WHEN** the user taps "Add phone" in the contact creation form
- **THEN** a new empty phone row SHALL appear with a primary radio unselected

#### Scenario: Submit with two phones and no primary selected

- **WHEN** the user submits the form with two non-empty phone rows and no primary radio selected
- **THEN** the form SHALL display a validation error and SHALL NOT submit

#### Scenario: Submit with two phones and a primary selected

- **WHEN** the user submits the form with two non-empty phone rows and one marked primary
- **THEN** `contactsStore.addContact` SHALL be called with both phones and the selected one flagged `isPrimary: true`

#### Scenario: Submit with a single phone row

- **WHEN** the user submits the form with only one non-empty phone row
- **THEN** that phone SHALL be submitted with `isPrimary: true` regardless of the primary radio state

#### Scenario: Remove a phone row

- **WHEN** the user taps the remove action on a phone row in the form
- **THEN** the row SHALL be removed; if the removed row was the selected primary and other rows remain, the primary radio SHALL reset to the first remaining row

### Requirement: Contact detail view primary phone selection

The contact detail view SHALL render every phone method with a primary radio. Selecting a non-primary phone as primary SHALL call `setPrimaryPhone` so the store updates the invariant and the view re-renders with the new primary first.

#### Scenario: Toggle primary between two existing phones — success

- **WHEN** the contact has two phone methods and the user selects the currently non-primary phone's primary star control
- **THEN** the store SHALL call `setPrimaryPhone(contactId, newPrimaryId)` and, after the repository call succeeds, the selected phone SHALL have `isPrimary: true` while the other has `isPrimary: false`

#### Scenario: Toggle primary fails — previous primary retained

- **WHEN** the user selects a non-primary phone as primary and the `setPrimaryPhone` repository call rejects
- **THEN** the previously primary phone SHALL remain primary in the store and in the DB
- **AND** the UI SHALL surface an error (e.g. snackbar) and restore the star highlight to the previous primary row

#### Scenario: Add a new phone — default not primary when primary exists

- **WHEN** the user adds a phone method to a contact that already has a primary phone
- **THEN** the new phone SHALL be inserted with `isPrimary: false` and the existing primary SHALL remain

#### Scenario: Add the first phone — auto primary

- **WHEN** the user adds a phone method to a contact with zero existing phones
- **THEN** the new phone SHALL be inserted with `isPrimary: true`

#### Scenario: Remove the current primary phone

- **WHEN** the user removes the phone method currently marked primary and other phone methods remain
- **THEN** the store SHALL mark the next remaining phone (by insertion order) as primary via `setPrimaryPhone`

## MODIFIED Requirements

### Requirement: Contacts store

A Pinia store (`useContactsStore`) SHALL manage the list of contacts (including their contact methods) with reactive `contacts`, `isLoading`, and `error` state. The `addContact` action SHALL accept multiple phone entries and enforce the single-primary invariant on write.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the contacts store SHALL automatically fetch all contacts with their contact methods

#### Scenario: Add contact with multiple phones

- **WHEN** `addContact(firstName, lastName?, displayName?, phones?)` is called with `phones = [{ value: v1, isPrimary: true }, { value: v2, isPrimary: false }]`
- **THEN** the store SHALL create the contact, then insert both phone contact methods — the first with `is_primary = true`, the second with `is_primary = false` — add the full contact with ordered methods to the local list, and re-sort by firstName

#### Scenario: Add contact with one phone

- **WHEN** `addContact` is called with `phones = [{ value, isPrimary: true }]`
- **THEN** the store SHALL create the contact and a single phone method with `isPrimary: true`

#### Scenario: Add contact without phone

- **WHEN** `addContact` is called with no `phones` or with an empty array
- **THEN** the store SHALL create the contact with empty `contactMethods` array

#### Scenario: Add contact with multiple phones but none primary

- **WHEN** `addContact` is called with two or more phones and none is marked `isPrimary: true`
- **THEN** the store SHALL throw a validation error and SHALL NOT create the contact

#### Scenario: Store update reflects in list

- **WHEN** `updateContact` action completes successfully
- **THEN** the local contacts array is updated with the new data and re-sorted by first name

#### Scenario: Store delete reflects in list

- **WHEN** `deleteContact` action completes successfully
- **THEN** the contact is removed from the local contacts array immediately

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the contacts store SHALL clear its cached contacts list

### Requirement: Contact list item display

Each contact in the list SHALL display the resolved contact name (using existing `resolveContactName()` logic) and the primary phone number if available. Each row SHALL be tappable to navigate to the contact detail/edit view within the sheet.

#### Scenario: Contact with one phone number

- **WHEN** a contact has exactly one phone method
- **THEN** the list item shows the contact name and that phone number below it

#### Scenario: Contact with multiple phones

- **WHEN** a contact has multiple phone methods
- **THEN** the list item subtitle SHALL show the phone method marked `isPrimary: true`

#### Scenario: Contact without contact methods

- **WHEN** a contact has no contact methods (name only)
- **THEN** the list item shows the contact name with no secondary text

#### Scenario: Tap contact to open detail

- **WHEN** user taps a contact row in the list
- **THEN** the sheet navigates to the detail/edit view for that contact
