## ADDED Requirements

### Requirement: Edit contact name fields

The system SHALL allow editing a contact's firstName, lastName, and displayName from the contact detail view. The firstName field SHALL remain required. Changes SHALL be persisted to Supabase via the `ContactsRepository.updateContact()` method.

#### Scenario: Edit first name

- **WHEN** user changes the first name field and saves
- **THEN** the contact's first name is updated in Supabase and the contacts list reflects the change

#### Scenario: Edit with empty first name rejected

- **WHEN** user clears the first name field and attempts to save
- **THEN** the system shows a validation error and does not persist the change

#### Scenario: Edit optional name fields

- **WHEN** user edits the lastName or displayName fields (including clearing them) and saves
- **THEN** the changes are persisted and the contacts list reflects the updated name

### Requirement: ContactsRepository supports update

The `ContactsRepository` interface SHALL include an `updateContact(id, data)` method that accepts a contact ID and partial contact data (excluding `id`, `userId`, and `contactMethods`). The Supabase implementation SHALL perform an UPDATE query and return the updated contact with joined contact methods.

#### Scenario: Update contact via repository

- **WHEN** `updateContact` is called with a valid contact ID and partial data
- **THEN** the contact row in Supabase is updated and the full updated contact (with methods) is returned

### Requirement: Edit contact methods

The contact detail view SHALL display all existing contact methods as editable rows. Each row shows the method type (phone/email), value, and an optional label. Users SHALL be able to edit the value and label of existing methods.

#### Scenario: Edit phone number value

- **WHEN** user changes the value of a phone contact method and saves
- **THEN** the method is updated in Supabase via `ContactMethodsRepository.updateMethod()`

#### Scenario: Edit method label

- **WHEN** user changes the label of a contact method (e.g., "Mobile" → "Work") and saves
- **THEN** the label is updated in Supabase

### Requirement: Add new contact methods from edit view

The contact detail view SHALL include an "Add method" action that allows adding a new phone or email method to the contact. This uses the existing `ContactMethodsRepository.addMethod()`.

#### Scenario: Add phone method to existing contact

- **WHEN** user taps "Add method", selects phone type, enters a number, and saves
- **THEN** a new phone method is added to the contact and displayed in the methods list

#### Scenario: Add email method to existing contact

- **WHEN** user taps "Add method", selects email type, enters an email, and saves
- **THEN** a new email method is added to the contact and displayed in the methods list

### Requirement: Remove contact methods from edit view

The contact detail view SHALL allow removing individual contact methods. Each method row SHALL have a remove action. This uses existing `ContactMethodsRepository.removeMethod()`.

#### Scenario: Remove a contact method

- **WHEN** user taps the remove action on a contact method
- **THEN** the method is deleted from Supabase and removed from the methods list

#### Scenario: Contact with no methods after removal

- **WHEN** user removes the last contact method from a contact
- **THEN** the contact remains valid with no methods (name-only contact is allowed)

### Requirement: ContactMethodsRepository supports update

The `ContactMethodsRepository` interface SHALL include an `updateMethod(id, data)` method that accepts a method ID and partial method data (excluding `id` and `contactId`). The Supabase implementation SHALL perform an UPDATE query and return the updated method.

#### Scenario: Update method via repository

- **WHEN** `updateMethod` is called with a valid method ID and partial data
- **THEN** the method row in Supabase is updated and the full updated method is returned

### Requirement: Contacts store supports update

The Pinia contacts store SHALL include an `updateContact()` action that calls the repository, updates the local contacts array, and re-sorts alphabetically.

#### Scenario: Store update reflects in list

- **WHEN** `updateContact` action completes successfully
- **THEN** the local contacts array is updated with the new data and re-sorted by first name

### Requirement: Navigate back from detail to list

The contact detail/edit view SHALL include a back navigation action that returns to the contacts list. Unsaved changes SHALL be discarded on back navigation.

#### Scenario: Back to list from detail

- **WHEN** user taps the back button in the contact detail view
- **THEN** the sheet returns to the contacts list view
