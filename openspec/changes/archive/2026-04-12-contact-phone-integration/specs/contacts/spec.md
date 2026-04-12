## MODIFIED Requirements

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

A repository SHALL provide methods to fetch all contacts (with their contact methods) for the current user and create new contacts in the `contacts` Supabase table.

#### Scenario: Fetch contacts with methods

- **WHEN** `fetchContacts()` is called
- **THEN** the repository SHALL SELECT all contacts for the current user with joined `contact_methods(*)`, ordered by `first_name`

#### Scenario: Create contact

- **WHEN** `createContact(contact)` is called
- **THEN** the repository SHALL INSERT the contact into `contacts` and return the created row with its generated ID

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

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the contacts store SHALL clear its cached contacts list

### Requirement: Contact creation dialog

A dialog component SHALL allow users to create new contacts with a first name (required), last name (optional), display name (optional), and phone number (optional).

#### Scenario: Valid submission with phone

- **WHEN** the user fills in at least the first name and a phone number and submits
- **THEN** the dialog SHALL call `contactsStore.addContact()` with all fields including phone and close

#### Scenario: Valid submission without phone

- **WHEN** the user fills in at least the first name without a phone number and submits
- **THEN** the dialog SHALL call `contactsStore.addContact()` without phone and close

#### Scenario: Missing required field

- **WHEN** the user submits without a first name
- **THEN** the form SHALL display a validation error
