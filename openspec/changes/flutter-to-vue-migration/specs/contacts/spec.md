## ADDED Requirements

### Requirement: Contact model with Zod validation

A Zod schema SHALL define the contact shape: `id` (string), `userId` (string), `firstName` (string, required), `lastName` (string, nullable), `displayName` (string, nullable). A computed `fullName` SHALL concatenate firstName and lastName.

#### Scenario: Valid contact from Supabase

- **WHEN** a contact row is fetched from the `contacts` table
- **THEN** the Zod schema SHALL parse it into a typed `Contact` object

#### Scenario: Display name resolution

- **WHEN** rendering a contact's name
- **THEN** the display SHALL prefer `displayName`, then fall back to `fullName` (firstName + lastName), then `firstName` alone

### Requirement: Contacts repository

A repository SHALL provide methods to fetch all contacts for the current user and create new contacts in the `contacts` Supabase table.

#### Scenario: Fetch contacts

- **WHEN** `fetchContacts()` is called
- **THEN** the repository SHALL SELECT all contacts for the current user, ordered by `first_name`

#### Scenario: Create contact

- **WHEN** `createContact(contact)` is called
- **THEN** the repository SHALL INSERT the contact and return the created row with its generated ID

### Requirement: Contacts store

A Pinia store (`useContactsStore`) SHALL manage the list of contacts with reactive `contacts`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the contacts store SHALL automatically fetch all contacts for the current user

#### Scenario: Add contact

- **WHEN** `addContact(firstName, lastName?, displayName?)` is called
- **THEN** the store SHALL trim/normalize inputs, call the repository to create the contact, add it to the local list, and re-sort by firstName

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the contacts store SHALL clear its cached contacts list

### Requirement: Contact creation dialog

A dialog component SHALL allow users to create new contacts with a first name (required), last name (optional), and display name (optional).

#### Scenario: Valid submission

- **WHEN** the user fills in at least the first name and submits
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
