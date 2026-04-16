## MODIFIED Requirements

### Requirement: Import contacts via Contact Picker API

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting `name` and `tel` properties with multi-select enabled. Each returned contact's phone number SHALL be normalized via the shared `normalizePhone` utility (see `phone-formatting` spec). When normalization succeeds, the canonical international form replaces the raw value. When normalization fails on a non-empty raw value, the raw value SHALL be retained on the returned object so the user can correct it after import.

#### Scenario: User selects one or more device contacts with parseable phones

- **WHEN** the user selects contacts from the native picker and each phone is parseable (Swiss national, international, or 00-prefixed)
- **THEN** the composable SHALL return an array of objects with `firstName`, `lastName` (parsed from full name), and `phoneNumber` set to the canonical international form (e.g. `+41 79 123 45 67`)

#### Scenario: User selects a contact with an unparseable phone

- **WHEN** the user selects a contact whose `tel` value cannot be parsed by `normalizePhone`
- **THEN** the composable SHALL return that contact with `phoneNumber` equal to the raw `tel` value (trimmed)

#### Scenario: User selects a contact with no phone

- **WHEN** a selected contact has no `tel` entries
- **THEN** the composable SHALL return that contact with `phoneNumber: null`

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting
- **THEN** the composable SHALL return an empty array

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari. Each parsed contact's phone number SHALL be normalized via the shared `normalizePhone` utility (see `phone-formatting` spec). When normalization succeeds, the canonical international form replaces the raw value. When normalization fails on a non-empty raw value, the raw value SHALL be retained.

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

#### Scenario: Extract and normalize parseable phone number

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67`
- **THEN** the parser SHALL extract the value and `phoneNumber` SHALL equal the canonical international form `+41 79 123 45 67`

#### Scenario: Extract and normalize national phone number

- **WHEN** a vCard contains `TEL;TYPE=CELL:0791234567`
- **THEN** `phoneNumber` SHALL equal `+41 79 123 45 67` (normalized using default region `CH`)

#### Scenario: Extract unparseable phone number

- **WHEN** a vCard contains a `TEL` field whose value cannot be parsed (e.g. `TEL:ext. 1234`)
- **THEN** `phoneNumber` SHALL equal the trimmed raw value (`ext. 1234`)

#### Scenario: vCard without phone

- **WHEN** a vCard block contains no `TEL` field
- **THEN** `phoneNumber` SHALL be `null`

#### Scenario: Single name token

- **WHEN** a contact has only one name token (e.g., `FN:Max`)
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

## ADDED Requirements

### Requirement: Import results surface unparseable phones

The contact creation dialog SHALL distinguish imported contacts whose phone could not be normalized so the user knows which entries to fix.

#### Scenario: Import-results row for unparseable phone

- **WHEN** the import-results view renders a row whose `phoneNumber` is non-null but does not match the canonical international format
- **THEN** the row SHALL display a visible "couldn't parse" indicator next to the phone number (e.g. an info icon or muted label) so the user can open the contact and fix it

#### Scenario: Import-results row for canonical phone

- **WHEN** the import-results view renders a row whose `phoneNumber` is in canonical international format (or null)
- **THEN** no "couldn't parse" indicator SHALL be shown
