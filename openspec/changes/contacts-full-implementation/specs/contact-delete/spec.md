## ADDED Requirements

### Requirement: Delete contact from detail view

The contact detail view SHALL include a "Delete" action. Deleting a contact SHALL remove the contact and all associated contact methods from Supabase. The system SHALL NOT allow accidental deletion — a confirmation step is required.

#### Scenario: Delete contact with confirmation

- **WHEN** user taps "Delete" on a contact in the detail view
- **THEN** an inline confirmation prompt appears (e.g., "Are you sure? Delete / Cancel")
- **WHEN** user confirms deletion
- **THEN** the contact and all its methods are deleted from Supabase, the contacts list updates, and the view returns to the contacts list

#### Scenario: Cancel deletion

- **WHEN** user taps "Delete" and then taps "Cancel" on the confirmation prompt
- **THEN** the contact is not deleted and the detail view remains open

#### Scenario: Delete contact that is a tour partner

- **WHEN** user deletes a contact that is referenced as a partner in one or more tours
- **THEN** the contact is deleted (Supabase foreign key cascade or application-level cleanup handles partner references)

### Requirement: ContactsRepository supports delete

The `ContactsRepository` interface SHALL include a `deleteContact(id)` method that accepts a contact ID. The Supabase implementation SHALL perform a DELETE query. Associated contact methods SHALL be removed via database cascade.

#### Scenario: Delete contact via repository

- **WHEN** `deleteContact` is called with a valid contact ID
- **THEN** the contact row and all associated contact_methods rows are deleted from Supabase

### Requirement: Contacts store supports delete

The Pinia contacts store SHALL include a `deleteContact()` action that calls the repository and removes the contact from the local contacts array.

#### Scenario: Store delete reflects in list

- **WHEN** `deleteContact` action completes successfully
- **THEN** the contact is removed from the local contacts array immediately

### Requirement: Loading and error states for delete

The delete operation SHALL show a loading indicator while in progress and display an error message if the operation fails. The contact SHALL NOT be removed from the local list until the server confirms deletion.

#### Scenario: Delete loading state

- **WHEN** deletion is in progress
- **THEN** the delete button shows a loading indicator and further actions are disabled

#### Scenario: Delete error handling

- **WHEN** the delete operation fails (network error, server error)
- **THEN** an error message is displayed and the contact remains in the list
