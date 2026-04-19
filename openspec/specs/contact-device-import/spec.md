## ADDED Requirements

### Requirement: Imported phones array shape

The vCard parser and Contact Picker composable SHALL each return, per contact, a `phones` array where every entry has `value: string` (canonical international form when parseable, else the trimmed raw value), `label: string | null`, and `isPrimary: boolean`. Exactly one entry in a non-empty `phones` array SHALL have `isPrimary = true`.

#### Scenario: Single-phone contact

- **WHEN** an imported contact has exactly one phone
- **THEN** the `phones` array SHALL contain one entry with `isPrimary: true`

#### Scenario: Multi-phone contact

- **WHEN** an imported contact has two or more phones
- **THEN** the `phones` array SHALL contain one entry per phone with exactly one having `isPrimary: true`

#### Scenario: Contact with no phones

- **WHEN** an imported contact has no phones
- **THEN** the `phones` array SHALL be empty

## MODIFIED Requirements

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari. Every `TEL` line in a vCard block SHALL be extracted into the contact's `phones` array. Each entry's `value` SHALL be normalized via the shared `normalizePhone` utility (see `phone-formatting` spec); when normalization succeeds, the canonical international form replaces the raw value; when normalization fails on a non-empty raw value, the raw value SHALL be retained. Each entry's `label` SHALL be derived from the `TEL` parameter types (e.g. `TYPE=CELL` → "Mobile", `TYPE=HOME` → "Home", `TYPE=WORK` → "Work"); when no recognised type is present, `label` SHALL be `null`. Primary selection SHALL use the following precedence, stopping at the first rule that selects an entry:

1. A `TEL` entry carrying a preference marker (vCard 3.0 `TYPE=PREF` or vCard 4.0 `PREF=` parameter). When multiple entries carry `PREF=`, the lowest numeric value wins.
2. The first `TEL` entry whose `TYPE` parameter includes `CELL`.
3. The first `TEL` entry whose `TYPE` parameter includes `HOME`.
4. The first `TEL` entry whose `TYPE` parameter includes `WORK`.
5. The first `TEL` entry in document order.

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

#### Scenario: Extract multiple phones with labels

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` and `TEL;TYPE=HOME:+41 44 222 33 44`
- **THEN** `phones` SHALL be `[{ value: '+41 79 123 45 67', label: 'Mobile', isPrimary: true }, { value: '+41 44 222 33 44', label: 'Home', isPrimary: false }]`

#### Scenario: vCard 3.0 PREF marker selects primary

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` followed by `TEL;TYPE=HOME,PREF:+41 44 222 33 44`
- **THEN** the second entry SHALL have `isPrimary: true` and the first `isPrimary: false`

#### Scenario: vCard 4.0 PREF parameter selects primary

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` followed by `TEL;TYPE=HOME;PREF=1:+41 44 222 33 44`
- **THEN** the second entry SHALL have `isPrimary: true`

#### Scenario: No PREF — CELL wins over HOME and WORK

- **WHEN** a vCard contains `TEL;TYPE=HOME:+41 44 222 33 44`, `TEL;TYPE=WORK:+41 44 555 66 77`, then `TEL;TYPE=CELL:+41 79 123 45 67` (in that order) and no entry carries PREF
- **THEN** the `CELL` entry SHALL have `isPrimary: true` regardless of document order

#### Scenario: No PREF and no CELL — HOME wins over WORK

- **WHEN** a vCard contains `TEL;TYPE=WORK:+41 44 555 66 77` followed by `TEL;TYPE=HOME:+41 44 222 33 44` and no PREF or CELL entries
- **THEN** the `HOME` entry SHALL have `isPrimary: true`

#### Scenario: No PREF, CELL, HOME, or WORK — first TEL is primary

- **WHEN** a vCard contains two `TEL` entries and neither carries PREF and no entry's `TYPE` includes `CELL`, `HOME`, or `WORK`
- **THEN** the first entry in document order SHALL have `isPrimary: true`

#### Scenario: Normalize national phone number per entry

- **WHEN** a vCard contains `TEL;TYPE=CELL:0791234567`
- **THEN** that entry's `value` SHALL equal `+41 79 123 45 67` (normalized using default region `CH`)

#### Scenario: Unparseable phone retains raw value

- **WHEN** a vCard contains a `TEL` field whose value cannot be parsed (e.g. `TEL:ext. 1234`)
- **THEN** that entry's `value` SHALL equal the trimmed raw value (`ext. 1234`) and the entry SHALL still be included in `phones`

#### Scenario: vCard without phone

- **WHEN** a vCard block contains no `TEL` field
- **THEN** `phones` SHALL be an empty array

#### Scenario: Unrecognised TYPE parameter yields null label

- **WHEN** a vCard contains `TEL;TYPE=FAX:+41 44 222 33 44`
- **THEN** the entry's `label` SHALL be `null`

#### Scenario: Single name token

- **WHEN** a contact has only one name token (e.g., `FN:Max`)
- **THEN** `firstName` SHALL be "Max" and `lastName` SHALL be `null`

### Requirement: Import contacts via Contact Picker API

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting `name` and `tel` properties with multi-select enabled. Every `tel` entry returned by the platform SHALL be included in the contact's `phones` array. Each entry's `value` SHALL be normalized via `normalizePhone`; when normalization succeeds, the canonical international form replaces the raw value; when normalization fails on a non-empty raw value, the raw value SHALL be retained. The first `tel` entry SHALL be marked `isPrimary: true` (the Contact Picker API does not expose preference). `label` SHALL be `null` for every entry.

#### Scenario: User selects a contact with multiple phones

- **WHEN** the user selects a contact whose device record has two phone numbers
- **THEN** the composable SHALL return that contact with two `phones` entries, the first having `isPrimary: true` and the second `isPrimary: false`

#### Scenario: User selects a contact with one parseable phone

- **WHEN** the user selects a contact with a single parseable phone
- **THEN** `phones` SHALL contain one entry with the canonical international value and `isPrimary: true`

#### Scenario: User selects a contact with an unparseable phone

- **WHEN** the user selects a contact whose `tel` value cannot be parsed by `normalizePhone`
- **THEN** `phones` SHALL contain one entry with `value` equal to the trimmed raw `tel` value and `isPrimary: true`

#### Scenario: User selects a contact with no phone

- **WHEN** a selected contact has no `tel` entries
- **THEN** `phones` SHALL be an empty array

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting
- **THEN** the composable SHALL return an empty array

### Requirement: Importing via Contact Picker

The contact creation dialog SHALL display import options based on platform capabilities and commit every imported phone per contact.

#### Scenario: Importing via Contact Picker

- **WHEN** the user taps "Import from contacts" and selects device contacts
- **THEN** the app SHALL create a TourenBuddy contact for each selected contact, insert one `contact_methods` phone row per entry in the contact's `phones` array, and display a snackbar confirming the count

#### Scenario: Importing via vCard file

- **WHEN** the user taps "Import from file" and selects a `.vcf` file
- **THEN** the app SHALL parse the file, create a TourenBuddy contact for each vCard entry with one `contact_methods` phone row per phone in `phones`, and display a snackbar confirming the count

#### Scenario: Import with duplicate prevention

- **WHEN** an imported contact (from either method) matches an existing TourenBuddy contact by first name AND last name (case-insensitive)
- **THEN** the import SHALL skip that contact and the snackbar SHALL indicate how many were skipped

### Requirement: Import results surface unparseable phones

The contact creation dialog SHALL distinguish imported contacts whose primary phone could not be normalized so the user knows which entries to fix. When a contact has multiple phones, the import-results row SHALL show the primary phone inline and the remaining phones collapsed behind a "+N more" indicator.

#### Scenario: Import-results row for unparseable primary phone

- **WHEN** the import-results view renders a row whose primary phone `value` is non-null but does not match the canonical international format
- **THEN** the row SHALL display a visible "couldn't parse" indicator next to the phone number (e.g. an info icon or muted label) so the user can open the contact and fix it

#### Scenario: Import-results row for canonical primary phone

- **WHEN** the import-results view renders a row whose primary phone `value` is in canonical international format (or the contact has no phones)
- **THEN** no "couldn't parse" indicator SHALL be shown

#### Scenario: Import-results row collapses secondary phones

- **WHEN** an imported contact has more than one phone
- **THEN** the import-results row SHALL display only the primary phone inline and a "+N more" indicator where N is the count of remaining phones
