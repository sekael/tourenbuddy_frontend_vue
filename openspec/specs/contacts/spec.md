## ADDED Requirements

### Requirement: Contact model with Zod validation

A Zod schema SHALL define the contact shape: `id` (string), `userId` (string), `firstName` (string, required), `lastName` (string, nullable), `displayName` (string, nullable), `contactMethods` (array of `ContactMethod`, default empty). A computed `fullName` SHALL concatenate firstName and lastName.

#### Scenario: Valid contact with methods from Supabase

- **WHEN** a contact row is fetched from the `contacts` table with joined `contact_methods`
- **THEN** the Zod schema SHALL parse it into a typed `Contact` object with `contactMethods` array populated

#### Scenario: Contact with no methods

- **WHEN** a contact row is fetched with no related `contact_methods` rows
- **THEN** the `contactMethods` array SHALL be empty

#### Scenario: Display name resolution

- **WHEN** rendering a contact's name
- **THEN** the display SHALL prefer `displayName`, then fall back to `fullName` (firstName + lastName), then `firstName` alone

### Requirement: Contacts repository

A repository SHALL provide methods to fetch all contacts (with their contact methods) for the current user, create new contacts, update existing contacts, and delete contacts in the `contacts` Supabase table.

#### Scenario: Fetch contacts with methods

- **WHEN** `fetchContacts()` is called
- **THEN** the repository SHALL SELECT all contacts for the current user with joined `contact_methods(*)`, ordered by `first_name`

#### Scenario: Create contact

- **WHEN** `createContact(contact)` is called
- **THEN** the repository SHALL INSERT the contact into `contacts` and return the created row with its generated ID

#### Scenario: Update contact via repository

- **WHEN** `updateContact` is called with a valid contact ID and partial data (excluding `id`, `userId`, and `contactMethods`)
- **THEN** the contact row in Supabase is updated and the full updated contact (with methods) is returned

#### Scenario: Delete contact via repository

- **WHEN** `deleteContact` is called with a valid contact ID
- **THEN** the contact row and all associated `contact_methods` rows are deleted from Supabase (via database cascade)

### Requirement: ContactsRepository supports update

The `ContactsRepository` interface SHALL include an `updateContact(id, data)` method that accepts a contact ID and partial contact data (excluding `id`, `userId`, and `contactMethods`). The Supabase implementation SHALL perform an UPDATE query and return the updated contact with joined contact methods.

### Requirement: ContactsRepository supports delete

The `ContactsRepository` interface SHALL include a `deleteContact(id)` method that accepts a contact ID. The Supabase implementation SHALL perform a DELETE query. Associated contact methods SHALL be removed via database cascade.

### Requirement: ContactMethodsRepository supports update

The `ContactMethodsRepository` interface SHALL include an `updateMethod(id, data)` method that accepts a method ID and partial method data (excluding `id` and `contactId`). The Supabase implementation SHALL perform an UPDATE query and return the updated method.

#### Scenario: Update method via repository

- **WHEN** `updateMethod` is called with a valid method ID and partial data
- **THEN** the method row in Supabase is updated and the full updated method is returned

### Requirement: Contacts store

A Pinia store (`useContactsStore`) SHALL manage the list of contacts (including their contact methods) with reactive `contacts`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the contacts store SHALL automatically fetch all contacts with their contact methods

#### Scenario: Add contact with phone

- **WHEN** `addContact(firstName, lastName?, displayName?, phoneNumber?)` is called with a phone number
- **THEN** the store SHALL create the contact, then add a primary phone contact method via `ContactMethodsRepository`, add the full contact (with method) to the local list, and re-sort by firstName

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

### Requirement: Contacts store supports update

The Pinia contacts store SHALL include an `updateContact()` action that calls the repository, updates the local contacts array, and re-sorts alphabetically.

### Requirement: Contacts store supports delete

The Pinia contacts store SHALL include a `deleteContact()` action that calls the repository and removes the contact from the local contacts array. The contact SHALL NOT be removed from the local list until the server confirms deletion.

### Requirement: Contacts list sheet accessible from map overlay

The system SHALL display a contacts list sheet (BottomSheet on mobile, SideDrawer on desktop) when the user taps the "Contacts" FAB button on the map action overlay. The sheet SHALL show all contacts belonging to the authenticated user, sorted alphabetically by first name.

#### Scenario: Open contacts list from map overlay

- **WHEN** user taps the "Contacts" FAB button on the map action overlay
- **THEN** a contacts list sheet opens showing all saved contacts sorted alphabetically by first name

#### Scenario: Empty contacts state

- **WHEN** user opens the contacts list and has no contacts
- **THEN** the sheet displays an empty state message (e.g., "No contacts yet") and a prominent "Add contact" action

#### Scenario: Close contacts list

- **WHEN** user taps the close button on the contacts list sheet OR taps the map background
- **THEN** the contacts list sheet closes and returns to the map view

### Requirement: Map overlay button shows "Contacts" instead of "Add contact"

The map action overlay SHALL display a "Contacts" button with the `contacts` Material Symbol icon, replacing the previous "Add contact" button with the `person_add` icon. The button SHALL emit an `openContacts` event instead of `openAddContact`.

#### Scenario: Button label and icon

- **WHEN** the map action overlay is visible
- **THEN** the contacts FAB shows the `contacts` icon and has title "Contacts"

### Requirement: Contact list item display

Each contact in the list SHALL display the resolved contact name (using existing `resolveContactName()` logic) and the primary phone number if available. Each row SHALL be tappable to navigate to the contact detail/edit view within the sheet.

#### Scenario: Contact with phone number

- **WHEN** a contact has a primary phone method
- **THEN** the list item shows the contact name and the primary phone number below it

#### Scenario: Contact without contact methods

- **WHEN** a contact has no contact methods (name only)
- **THEN** the list item shows the contact name with no secondary text

#### Scenario: Tap contact to open detail

- **WHEN** user taps a contact row in the list
- **THEN** the sheet navigates to the detail/edit view for that contact

### Requirement: Add contact entry point from contacts list

The contacts list view SHALL include an "Add contact" action that opens the contact creation flow. This preserves existing import flows (vCard file, Contact Picker API) and manual form entry.

#### Scenario: Add contact from list view

- **WHEN** user taps the "Add contact" action in the contacts list
- **THEN** the sheet navigates to the contact creation view with import options and manual form

#### Scenario: Return to list after adding contact

- **WHEN** user completes adding a contact (manual or import)
- **THEN** the sheet returns to the contacts list with the new contact visible in the sorted list

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

### Requirement: Navigate back from detail to list

The contact detail/edit view SHALL include a back navigation action that returns to the contacts list. Unsaved changes SHALL be discarded on back navigation.

#### Scenario: Back to list from detail

- **WHEN** user taps the back button in the contact detail view
- **THEN** the sheet returns to the contacts list view

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

### Requirement: Loading and error states for delete

The delete operation SHALL show a loading indicator while in progress and display an error message if the operation fails. The contact SHALL NOT be removed from the local list until the server confirms deletion.

#### Scenario: Delete loading state

- **WHEN** deletion is in progress
- **THEN** the delete button shows a loading indicator and further actions are disabled

#### Scenario: Delete error handling

- **WHEN** the delete operation fails (network error, server error)
- **THEN** an error message is displayed and the contact remains in the list

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

### Requirement: Contact chip component

A reusable `ContactChip` component SHALL display a contact's name and support toggle selection for use in tour partner selection.

#### Scenario: Display contact name

- **WHEN** a ContactChip is rendered
- **THEN** it SHALL show the contact's resolved display name (displayName → fullName → firstName)

#### Scenario: Toggle selection

- **WHEN** a user clicks a ContactChip
- **THEN** it SHALL toggle between selected and unselected states, emitting the change to the parent

## MODIFIED Requirements

### Requirement: Contact chip design

The contact chip SHALL have a pill shape (border-radius: 9999px). When unselected, it SHALL have a transparent background with `--color-outline-variant` border. When selected, it SHALL have a subtle `--color-primary` tint background (10-15% opacity) with `--color-primary` border and `--color-primary` text, and display a Material Symbols `check` icon. Hover state SHALL use `--color-surface-variant` background.

#### Scenario: Selected chip uses tint instead of solid fill

- **WHEN** a contact chip is in selected state
- **THEN** it displays with a subtle primary-tinted background rather than a solid primary fill

#### Scenario: Chip uses Material Symbols checkmark

- **WHEN** a contact chip is selected
- **THEN** a Material Symbols `check` icon is displayed instead of a Unicode checkmark

### Requirement: Contact creation dialog styling

The contact creation dialog SHALL use the same modern dialog styling as tour creation: `--color-surface` background, `--shadow-lg`, 16px border-radius, `--color-outline-variant` border. The close/cancel button SHALL use Material Symbols `close` icon. Input fields SHALL use updated input styling.

#### Scenario: Contact creation dialog renders with modern design

- **WHEN** user opens the contact creation dialog
- **THEN** the dialog displays with updated color tokens, shadows, and input styles
