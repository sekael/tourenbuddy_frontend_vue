## MODIFIED Requirements

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse a single `.vcf` (vCard) file per invocation and extract contact information. The file picker SHALL NOT enable multi-file selection (the underlying `<input type="file">` SHALL omit the `multiple` attribute) and the composable SHALL accept exactly one `File` argument; passing zero or more than one file SHALL be rejected with a validation error before parsing begins. A vCard file MAY contain multiple `BEGIN:VCARD`/`END:VCARD` blocks and all blocks within the single file SHALL be parsed. This SHALL work on all browsers including iOS Safari. Every `TEL` line in a vCard block SHALL be extracted into the contact's `phones` array. Each entry's `value` SHALL be normalized via the shared `normalizePhone` utility (see `phone-formatting` spec); when normalization succeeds, the canonical international form replaces the raw value; when normalization fails on a non-empty raw value, the raw value SHALL be retained. Each entry's `label` SHALL be derived from the `TEL` parameter types (e.g. `TYPE=CELL` → "Mobile", `TYPE=HOME` → "Home", `TYPE=WORK` → "Work"); when no recognised type is present, `label` SHALL be `null`. Primary selection SHALL use the following precedence, stopping at the first rule that selects an entry:

1. A `TEL` entry carrying a preference marker (vCard 3.0 `TYPE=PREF` or vCard 4.0 `PREF=` parameter). When multiple entries carry `PREF=`, the lowest numeric value wins.
2. The first `TEL` entry whose `TYPE` parameter includes `CELL`.
3. The first `TEL` entry whose `TYPE` parameter includes `HOME`.
4. The first `TEL` entry whose `TYPE` parameter includes `WORK`.
5. The first `TEL` entry in document order.

#### Scenario: Picker rejects multi-select

- **WHEN** the import dialog renders the vCard file picker
- **THEN** the underlying file input SHALL NOT carry the `multiple` attribute and the OS file chooser SHALL allow selection of only one file

#### Scenario: Composable rejects multiple files

- **WHEN** `useVCardImport`'s parse method is invoked with more than one `File`
- **THEN** the composable SHALL throw a validation error and SHALL NOT parse any file

#### Scenario: Parse single-contact vCard file

- **WHEN** a `.vcf` file containing one `BEGIN:VCARD`/`END:VCARD` block is parsed
- **THEN** the parser SHALL extract the contact's name (from `FN` or `N` field) and return one parsed contact with its `phones` array

#### Scenario: Parse multi-contact vCard file

- **WHEN** a single `.vcf` file containing multiple `BEGIN:VCARD`/`END:VCARD` blocks is parsed
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

## ADDED Requirements

### Requirement: Import results integrate connect prompt

The import-results component SHALL, after parsing vCard or device-picker contacts, batch-call `useFriendshipsStore().findUsersByPhones(uniquePhones)` once for the union of unique normalized phone values across all parsed rows. Each result row whose phones include a matched verified user (excluding the caller) SHALL render the inline connect prompt defined by the `contact-account-linking` capability. Importing the contact and sending the friend request SHALL be independent operations — neither blocks the other.

#### Scenario: Import-results renders prompts

- **WHEN** the import results render and a parsed row's phone matches a verified user other than the caller
- **THEN** the row SHALL render the connect prompt with "Send request" and "Just save contact" actions

#### Scenario: Import succeeds when request fails

- **WHEN** the user taps "Send request" and the friend-request RPC fails
- **THEN** the contact import SHALL still complete on user confirmation AND a snackbar SHALL surface the request failure

#### Scenario: Discovery suppressed when caller unverified

- **WHEN** the calling user does not have `phone_confirmed_at` set
- **THEN** no batch discovery call SHALL be made and no prompts SHALL render in import results
