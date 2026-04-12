## ADDED Requirements

### Requirement: Contact Picker API feature detection

The app SHALL detect whether the Contact Picker API (`navigator.contacts`) is available in the current browser. A `useContactPicker` composable SHALL expose a reactive `isSupported` boolean.

#### Scenario: Supported browser (Android Chrome)

- **WHEN** the app runs on a browser supporting the Contact Picker API
- **THEN** `isSupported` SHALL be `true`

#### Scenario: Unsupported browser (desktop, iOS Safari)

- **WHEN** the app runs on a browser without Contact Picker API support
- **THEN** `isSupported` SHALL be `false`

### Requirement: Import contacts via Contact Picker API

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting `name` and `tel` properties with multi-select enabled.

#### Scenario: User selects one or more device contacts

- **WHEN** the user selects contacts from the native picker
- **THEN** the composable SHALL return an array of objects with `firstName`, `lastName` (parsed from full name), and `phoneNumber` (first phone number or null)

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting
- **THEN** the composable SHALL return an empty array

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari.

#### Scenario: Parse single-contact vCard file

- **WHEN** a `.vcf` file containing one `BEGIN:VCARD`/`END:VCARD` block is parsed
- **THEN** the parser SHALL extract the contact's name (from `FN` or `N` field) and phone number (from first `TEL` field) and return one parsed contact

#### Scenario: Parse multi-contact vCard file

- **WHEN** a `.vcf` file containing multiple `BEGIN:VCARD`/`END:VCARD` blocks is parsed
- **THEN** the parser SHALL return an array with one parsed contact per vCard block

#### Scenario: Parse structured name field (N)

- **WHEN** a vCard contains `N:Muster;Max;;;` (structured name: last;first;middle;prefix;suffix)
- **THEN** the parser SHALL extract `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Parse formatted name field (FN)

- **WHEN** a vCard contains `FN:Max Muster` but no `N` field
- **THEN** the parser SHALL split into `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Extract phone number

- **WHEN** a vCard contains one or more `TEL` fields (e.g., `TEL;TYPE=CELL:+41 79 123 45 67`)
- **THEN** the parser SHALL extract the first phone number value

#### Scenario: vCard without phone

- **WHEN** a vCard block contains no `TEL` field
- **THEN** `phoneNumber` SHALL be `null`

#### Scenario: Single name token

- **WHEN** a contact has only one name token (e.g., `FN:Max`)
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

### Requirement: Contact name parsing

A shared name parsing utility SHALL split full name strings into firstName and lastName components, used by both Contact Picker API and vCard import.

#### Scenario: Two-part name

- **WHEN** a full name like "Max Muster" is parsed
- **THEN** the parser SHALL split into `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Single name

- **WHEN** a full name has only one token (e.g., "Max")
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

#### Scenario: Multi-part name

- **WHEN** a full name has three or more tokens (e.g., "Max von Muster")
- **THEN** `firstName` SHALL be the first token ("Max") and `lastName` SHALL be the remaining tokens joined ("von Muster")

### Requirement: Import buttons in contact creation dialog

The contact creation dialog SHALL display import options based on platform capabilities.

#### Scenario: Import from file button always visible

- **WHEN** the contact creation dialog opens on any browser
- **THEN** an "Import from file" button SHALL be visible, accepting `.vcf` and `.vcard` files

#### Scenario: Import from contacts button on supported browsers

- **WHEN** the contact creation dialog opens on a browser supporting Contact Picker API
- **THEN** an additional "Import from contacts" button SHALL be visible alongside the file import button

#### Scenario: Importing via Contact Picker

- **WHEN** the user taps "Import from contacts" and selects device contacts
- **THEN** the app SHALL create a TourenBuddy contact for each selected contact and display a snackbar confirming the count

#### Scenario: Importing via vCard file

- **WHEN** the user taps "Import from file" and selects a `.vcf` file
- **THEN** the app SHALL parse the file, create a TourenBuddy contact for each vCard entry, and display a snackbar confirming the count

#### Scenario: Import with duplicate prevention

- **WHEN** an imported contact (from either method) matches an existing TourenBuddy contact by first name AND last name (case-insensitive)
- **THEN** the import SHALL skip that contact and the snackbar SHALL indicate how many were skipped
