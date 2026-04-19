## MODIFIED Requirements

### Requirement: Import contacts via Contact Picker API

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting `name` and `tel` properties with multi-select enabled. Each returned contact's phone number SHALL be normalized via the shared `normalizePhone` utility (see `phone-formatting` spec). When normalization succeeds, the canonical E.164 form replaces the raw value. When normalization fails on a non-empty raw value, `phoneNumber` SHALL be set to `null` AND the raw value SHALL be retained on a separate `rawPhoneNumber` field so the import-results UI can display it with a "couldn't parse" indicator. The contact itself SHALL still be returned (name is still useful), but no phone contact method will be created downstream for that entry.

#### Scenario: User selects one or more device contacts with parseable phones

- **WHEN** the user selects contacts from the native picker and each phone is parseable
- **THEN** the composable SHALL return an array of objects with `firstName`, `lastName`, and `phoneNumber` set to the canonical E.164 form (e.g. `+41791234567`)

#### Scenario: User selects a contact with an unparseable phone

- **WHEN** the user selects a contact whose `tel` value cannot be parsed by `normalizePhone`
- **THEN** the composable SHALL return that contact with `phoneNumber: null` and `rawPhoneNumber` set to the trimmed raw `tel` value

#### Scenario: User selects a contact with no phone

- **WHEN** a selected contact has no `tel` entries
- **THEN** the composable SHALL return that contact with `phoneNumber: null` and `rawPhoneNumber: null`

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting
- **THEN** the composable SHALL return an empty array

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari. Each parsed contact's phone number SHALL be normalized via the shared `normalizePhone` utility. When normalization succeeds, the canonical E.164 form replaces the raw value. When normalization fails on a non-empty raw value, `phoneNumber` SHALL be set to `null` AND the raw value SHALL be retained on a separate `rawPhoneNumber` field. The contact itself SHALL still be parsed and returned.

#### Scenario: Parse single-contact vCard file

- **WHEN** a `.vcf` file containing one `BEGIN:VCARD`/`END:VCARD` block is parsed
- **THEN** the parser SHALL extract the contact's name (from `FN` or `N` field) and phone number (from first `TEL` field) and return one parsed contact

#### Scenario: Parse multi-contact vCard file

- **WHEN** a `.vcf` file containing multiple `BEGIN:VCARD`/`END:VCARD` blocks is parsed
- **THEN** the parser SHALL return an array with one parsed contact per vCard block

#### Scenario: Parse structured name field (N)

- **WHEN** a vCard contains `N:Muster;Max;;;`
- **THEN** the parser SHALL extract `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Parse formatted name field (FN)

- **WHEN** a vCard contains `FN:Max Muster` but no `N` field
- **THEN** the parser SHALL split into `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Extract and normalize parseable international phone number

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67`
- **THEN** `phoneNumber` SHALL equal `'+41791234567'` (E.164)

#### Scenario: Extract and normalize national phone number

- **WHEN** a vCard contains `TEL;TYPE=CELL:0791234567`
- **THEN** `phoneNumber` SHALL equal `'+41791234567'` (normalized using default region `CH`)

#### Scenario: Extract unparseable phone number

- **WHEN** a vCard contains a `TEL` field whose value cannot be parsed (e.g. `TEL:ext. 1234`)
- **THEN** `phoneNumber` SHALL be `null` and `rawPhoneNumber` SHALL equal `'ext. 1234'`

#### Scenario: vCard without phone

- **WHEN** a vCard block contains no `TEL` field
- **THEN** `phoneNumber` SHALL be `null` and `rawPhoneNumber` SHALL be `null`

#### Scenario: Single name token

- **WHEN** a contact has only one name token (e.g., `FN:Max`)
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

### Requirement: Import results surface unparseable phones

The contact creation dialog SHALL distinguish imported contacts whose phone could not be normalized so the user knows which entries to fix. Imported contacts with an unparseable phone SHALL be created without a phone contact method; the import-results row SHALL display the original raw value alongside a "couldn't parse" indicator.

#### Scenario: Import-results row for unparseable phone

- **WHEN** the import-results view renders a row whose `phoneNumber` is `null` and `rawPhoneNumber` is non-null
- **THEN** the row SHALL display the raw value alongside a visible "couldn't parse" indicator
- **AND** the imported contact SHALL exist with no phone contact method

#### Scenario: Import-results row for canonical phone

- **WHEN** the import-results view renders a row whose `phoneNumber` is in E.164 form
- **THEN** no "couldn't parse" indicator SHALL be shown
- **AND** the contact SHALL have a primary phone contact method with the E.164 value

#### Scenario: Import-results row for contact without phone

- **WHEN** the import-results view renders a row whose `phoneNumber` and `rawPhoneNumber` are both `null`
- **THEN** the row SHALL display the contact name only with no phone indicator
