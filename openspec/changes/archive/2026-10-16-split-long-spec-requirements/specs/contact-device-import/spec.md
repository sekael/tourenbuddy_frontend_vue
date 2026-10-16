# Spec Delta

## REMOVED Requirements

### Requirement: vCard file import

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "vCard file parsing", "vCard phone normalization", "vCard phone labels", "vCard primary phone selection", "vCard preference marker".

### Requirement: Import contacts via Contact Picker API

**Reason**: Split into one requirement per behavior (description over 500 characters); no behavior changes and every scenario is kept verbatim.
**Migration**: Now covered by "Contact Picker opens the native picker", "Contact Picker phone normalization", "Contact Picker primary phone".

## ADDED Requirements

### Requirement: vCard file parsing

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari.

#### Scenario: Parse single-contact vCard file

- **WHEN** a `.vcf` file containing one `BEGIN:VCARD`/`END:VCARD` block is parsed
- **THEN** the parser SHALL extract the contact's name (from `FN` or `N` field) and return one parsed contact with its `phones` array

#### Scenario: Parse multi-contact vCard file

- **WHEN** a `.vcf` file containing multiple `BEGIN:VCARD`/`END:VCARD` blocks is parsed
- **THEN** the parser SHALL return an array with one parsed contact per vCard block

#### Scenario: Parse structured name field (N)

- **WHEN** a vCard contains `N:Muster;Max;;;` (structured name: last;first;middle;prefix;suffix)
- **THEN** the parser SHALL extract `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Parse formatted name field (FN)

- **WHEN** a vCard contains `FN:Max Muster` but no `N` field
- **THEN** the parser SHALL split into `firstName: "Max"` and `lastName: "Muster"`

#### Scenario: Single name token

- **WHEN** a contact has only one name token (e.g., `FN:Max`)
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

### Requirement: vCard phone normalization

Every `TEL` line in a vCard block SHALL be processed; entries whose value normalizes successfully via the shared `normalizePhone` utility (see `phone-formatting` spec) SHALL be included in the contact's `phones` array with `value` set to its E.164 form. Entries whose value cannot be normalized SHALL NOT appear in `phones`; their trimmed raw value SHALL instead be appended to the contact's `rawPhoneNumbers` array.

#### Scenario: Normalize national phone number per entry

- **WHEN** a vCard contains `TEL;TYPE=CELL:0791234567`
- **THEN** that entry's `value` SHALL equal `+41791234567` (normalized using default region `CH`)

#### Scenario: Unparseable phone goes to rawPhoneNumbers, not phones

- **WHEN** a vCard contains a `TEL` field whose value cannot be parsed (e.g. `TEL:ext. 1234`)
- **THEN** that value SHALL NOT appear in `phones` AND the trimmed raw value (`ext. 1234`) SHALL be appended to `rawPhoneNumbers`

#### Scenario: vCard without phone

- **WHEN** a vCard block contains no `TEL` field
- **THEN** `phones` SHALL be an empty array

### Requirement: vCard phone labels

Each `phones` entry's `label` SHALL be derived from the `TEL` parameter types (e.g. `TYPE=CELL` → "Mobile", `TYPE=HOME` → "Home", `TYPE=WORK` → "Work"); when no recognised type is present, `label` SHALL be `null`.

#### Scenario: Extract multiple phones with labels

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` and `TEL;TYPE=HOME:+41 44 222 33 44`
- **THEN** `phones` SHALL be `[{ value: '+41791234567', label: 'Mobile', isPrimary: true }, { value: '+41442223344', label: 'Home', isPrimary: false }]`

#### Scenario: Unrecognised TYPE parameter yields null label

- **WHEN** a vCard contains `TEL;TYPE=FAX:+41 44 222 33 44`
- **THEN** the entry's `label` SHALL be `null`

### Requirement: vCard primary phone selection

Primary selection SHALL use the following precedence, stopping at the first rule that selects an entry:

1. A `TEL` entry carrying a preference marker (see "vCard preference marker").
2. The first `TEL` entry whose `TYPE` parameter includes `CELL`; failing that, `HOME`; failing that, `WORK`.
3. The first `TEL` entry in document order.

Primary selection SHALL operate on the deduplicated `phones` set (see "Dedupe identical phones during import"), not on the raw `TEL` line sequence.

#### Scenario: No PREF — CELL wins over HOME and WORK

- **WHEN** a vCard contains `TEL;TYPE=HOME:+41 44 222 33 44`, `TEL;TYPE=WORK:+41 44 555 66 77`, then `TEL;TYPE=CELL:+41 79 123 45 67` (in that order) and no entry carries PREF
- **THEN** the `CELL` entry SHALL have `isPrimary: true` regardless of document order

#### Scenario: No PREF and no CELL — HOME wins over WORK

- **WHEN** a vCard contains `TEL;TYPE=WORK:+41 44 555 66 77` followed by `TEL;TYPE=HOME:+41 44 222 33 44` and no PREF or CELL entries
- **THEN** the `HOME` entry SHALL have `isPrimary: true`

#### Scenario: No PREF, CELL, HOME, or WORK — first TEL is primary

- **WHEN** a vCard contains two `TEL` entries and neither carries PREF and no entry's `TYPE` includes `CELL`, `HOME`, or `WORK`
- **THEN** the first entry in document order SHALL have `isPrimary: true`

### Requirement: vCard preference marker

A `TEL` entry carrying a preference marker (vCard 3.0 `TYPE=PREF` or vCard 4.0 `PREF=` parameter) SHALL be selected as primary. When multiple entries carry `PREF=`, the lowest numeric value wins.

#### Scenario: vCard 3.0 PREF marker selects primary

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` followed by `TEL;TYPE=HOME,PREF:+41 44 222 33 44`
- **THEN** the second entry SHALL have `isPrimary: true` and the first `isPrimary: false`

#### Scenario: vCard 4.0 PREF parameter selects primary

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` followed by `TEL;TYPE=HOME;PREF=1:+41 44 222 33 44`
- **THEN** the second entry SHALL have `isPrimary: true`

### Requirement: Contact Picker opens the native picker

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting the `name` and `tel` properties with multi-select enabled.

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting, or the API is unsupported
- **THEN** the composable SHALL return an empty array

### Requirement: Contact Picker phone normalization

Each `tel` entry returned by the platform whose value normalizes successfully via `normalizePhone` SHALL be included in the contact's `phones` array with `value` set to its E.164 form. Entries whose value cannot be normalized SHALL NOT appear in `phones`; their trimmed raw value SHALL instead be appended to `rawPhoneNumbers`. `label` SHALL be `null` for every entry.

#### Scenario: User selects a contact with one parseable phone

- **WHEN** the user selects a contact with a single parseable phone
- **THEN** `phones` SHALL contain one entry with the E.164 value and `isPrimary: true`

#### Scenario: User selects a contact with an unparseable phone

- **WHEN** the user selects a contact whose `tel` value cannot be parsed by `normalizePhone`
- **THEN** `phones` SHALL be empty AND `rawPhoneNumbers` SHALL contain the trimmed raw `tel` value

#### Scenario: User selects a contact with no phone

- **WHEN** a selected contact has no `tel` entries
- **THEN** `phones` SHALL be an empty array

### Requirement: Contact Picker primary phone

The first parseable `tel` entry (in source order) SHALL be marked `isPrimary: true` in the deduplicated `phones` set (the Contact Picker API does not expose preference).

#### Scenario: User selects a contact with multiple phones

- **WHEN** the user selects a contact whose device record has two phone numbers
- **THEN** the composable SHALL return that contact with two `phones` entries, the first having `isPrimary: true` and the second `isPrimary: false`
