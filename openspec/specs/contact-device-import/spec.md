## Purpose

Import contacts from the device address book via the Contact Picker API or vCard upload, mapping fields to the app's contact schema.

## Requirements

### Requirement: Dedupe identical phones during import

Both import parsers (`useVCardImport.parseVCardText` and `useContactPicker.pickContacts`) SHALL, per contact, collapse multiple `phones` entries that share the same `value` into a single entry before returning. The merge SHALL OR the `isPrimary` flags (any `true` among collapsed entries wins) and SHALL keep the first non-null `label` in input order. Both parsers SHALL ALSO deduplicate `rawPhoneNumbers` per contact by `trim()` + lowercase comparison, preserving first-seen casing.

#### Scenario: vCard with two identical TEL lines

- **WHEN** a vCard contains two `TEL;TYPE=CELL:+41 79 123 45 67` lines for the same contact
- **THEN** `phones` SHALL contain exactly one entry with `value: '+41 79 123 45 67'`, `label: 'Mobile'`, and `isPrimary: true`

#### Scenario: vCard with two TEL lines normalizing to the same E.164

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41791234567` and `TEL;TYPE=HOME:079 123 45 67` (both normalize to `+41 79 123 45 67`)
- **THEN** `phones` SHALL contain exactly one entry with `value: '+41 79 123 45 67'`, `label: 'Mobile'` (first non-null label kept), and `isPrimary: true` (CELL wins under existing primary-selection rules over a deduped set)

#### Scenario: vCard duplicate where second copy carries PREF

- **WHEN** a vCard contains `TEL;TYPE=CELL:+41 79 123 45 67` then `TEL;TYPE=HOME,PREF:+41 79 123 45 67`
- **THEN** `phones` SHALL contain exactly one entry with `value: '+41 79 123 45 67'`, `label: 'Mobile'` (first non-null label), and `isPrimary: true` (PREF preserved via primary-selection running on the deduped set)

#### Scenario: Contact Picker returns duplicate tel values

- **WHEN** the Contact Picker yields a contact with `tel: ['+41 79 123 45 67', '+41 79 123 45 67']`
- **THEN** `phones` SHALL contain exactly one `PickedPhone` with `value: '+41 79 123 45 67'`, `label: null`, and `isPrimary: true`

#### Scenario: Duplicate unparseable raw values collapse

- **WHEN** an imported contact yields raw unparseable values `['ext. 1234', 'ext. 1234', 'EXT. 1234']` (mixed case, leading/trailing whitespace stripped)
- **THEN** `rawPhoneNumbers` SHALL contain exactly one entry equal to the first-seen casing (`'ext. 1234'`)

#### Scenario: Distinct numbers are not collapsed

- **WHEN** an imported contact yields two phones with different normalized values
- **THEN** `phones` SHALL contain two entries and no merge SHALL occur

### Requirement: Parsers emit emails alongside phones

Both `useVCardImport.parseVCardText` and `useContactPicker.pickContacts` SHALL return a per-contact `emails: string[]` array. vCard parser SHALL extract every `EMAIL` field in the block; Contact Picker SHALL request the `email` property in `navigator.contacts.select`. Each email SHALL be trimmed and lowercased; values not matching a basic `<local>@<domain>.<tld>` shape SHALL be dropped silently. The array SHALL be deduplicated by exact (post-lowercase) match preserving first-seen order.

#### Scenario: vCard contains EMAIL lines

- **WHEN** a vCard block contains `EMAIL:foo@example.com` and `EMAIL;TYPE=WORK:Foo@Example.com`
- **THEN** `emails` SHALL equal `['foo@example.com']`

#### Scenario: Contact Picker returns email values

- **WHEN** the Contact Picker yields `email: ['Foo@Example.com', 'bar@example.com']`
- **THEN** `emails` SHALL equal `['foo@example.com', 'bar@example.com']`

#### Scenario: Malformed emails dropped

- **WHEN** an importer encounters values like `'not-an-email'` or empty strings
- **THEN** those values SHALL NOT appear in `emails` and SHALL NOT raise an error

#### Scenario: No email entries

- **WHEN** the source contact has no email data
- **THEN** `emails` SHALL be an empty array

### Requirement: Per-contact handling of invalid-only and mixed phone sets

The contact-creation dialog import flow SHALL, for each parsed contact, branch on `(phones.length, rawPhoneNumbers.length, emails.length)`:

1. If `phones.length === 0` AND `rawPhoneNumbers.length > 0`, the contact SHALL be skipped (no row inserted) and a snackbar resolving i18n key `contacts.errors.noValidPhone` SHALL be displayed, naming the contact.
2. If `phones.length > 0` AND `rawPhoneNumbers.length > 0`, the contact SHALL be created with only the valid phones; a snackbar resolving i18n key `contacts.errors.someInvalidPhonesDiscarded` SHALL be displayed, naming the contact and the discarded count.
3. If `phones.length === 0` AND `rawPhoneNumbers.length === 0` AND `emails.length > 0`, the contact SHALL be created with the parsed emails as `email` contact methods and no phone methods (no snackbar).
4. If `phones.length === 0` AND `rawPhoneNumbers.length === 0` AND `emails.length === 0`, the contact SHALL be created with name only (existing behavior; no snackbar).
5. If `phones.length > 0` AND `rawPhoneNumbers.length === 0`, the contact SHALL be created normally (existing behavior; no snackbar).

The existing end-of-batch summary snackbar (imported / skipped counts) SHALL continue to fire and SHALL count contacts skipped under rule 1 in its skipped tally.

#### Scenario: Contact with TEL entries but none parseable

- **WHEN** the parser returns a contact with `phones: []` and `rawPhoneNumbers: ['ext. 1234']`
- **THEN** the dialog SHALL NOT create a TourenBuddy contact for that entry AND a snackbar resolving `contacts.errors.noValidPhone` SHALL display the contact's name

#### Scenario: Contact with mixed valid + invalid phones

- **WHEN** the parser returns a contact with `phones: [{ value: '+41 79 123 45 67', ... }]` and `rawPhoneNumbers: ['ext. 1234', 'pbx 100']`
- **THEN** the dialog SHALL create the contact with one phone method (`+41 79 123 45 67`) AND a snackbar resolving `contacts.errors.someInvalidPhonesDiscarded` SHALL display the name and the discarded count (`2`)

#### Scenario: Contact with no TEL but an email

- **WHEN** the parser returns a contact with `phones: []`, `rawPhoneNumbers: []`, and `emails: ['friend@example.com']`
- **THEN** the dialog SHALL create the contact with one `email` contact method and no phone methods, and SHALL emit no per-contact snackbar

#### Scenario: Contact with neither phone nor email

- **WHEN** the parser returns a contact with `phones: []`, `rawPhoneNumbers: []`, and `emails: []`
- **THEN** the dialog SHALL create the contact with name only and SHALL emit no per-contact snackbar

#### Scenario: Skipped contacts counted in batch summary

- **WHEN** the user imports 5 contacts where 1 is skipped under the invalid-only rule
- **THEN** the end-of-batch summary SHALL report `4` imported and at least `1` skipped

## MODIFIED Requirements

### Requirement: vCard file import

A `useVCardImport` composable SHALL provide a method to parse `.vcf` (vCard) files and extract contact information. This SHALL work on all browsers including iOS Safari. Every `TEL` line in a vCard block SHALL be processed; entries whose value normalizes successfully via the shared `normalizePhone` utility (see `phone-formatting` spec) SHALL be included in the contact's `phones` array with `value` set to the canonical international form. Entries whose value cannot be normalized SHALL NOT appear in `phones`; their trimmed raw value SHALL instead be appended to the contact's `rawPhoneNumbers` array. Each `phones` entry's `label` SHALL be derived from the `TEL` parameter types (e.g. `TYPE=CELL` → "Mobile", `TYPE=HOME` → "Home", `TYPE=WORK` → "Work"); when no recognised type is present, `label` SHALL be `null`. Primary selection SHALL use the following precedence, stopping at the first rule that selects an entry:

1. A `TEL` entry carrying a preference marker (vCard 3.0 `TYPE=PREF` or vCard 4.0 `PREF=` parameter). When multiple entries carry `PREF=`, the lowest numeric value wins.
2. The first `TEL` entry whose `TYPE` parameter includes `CELL`.
3. The first `TEL` entry whose `TYPE` parameter includes `HOME`.
4. The first `TEL` entry whose `TYPE` parameter includes `WORK`.
5. The first `TEL` entry in document order.

Primary selection SHALL operate on the deduplicated `phones` set (see "Dedupe identical phones during import"), not on the raw `TEL` line sequence.

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

#### Scenario: Unparseable phone goes to rawPhoneNumbers, not phones

- **WHEN** a vCard contains a `TEL` field whose value cannot be parsed (e.g. `TEL:ext. 1234`)
- **THEN** that value SHALL NOT appear in `phones` AND the trimmed raw value (`ext. 1234`) SHALL be appended to `rawPhoneNumbers`

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

The `useContactPicker` composable SHALL provide a `pickContacts()` method that opens the native contact picker requesting `name`, `tel`, and `email` properties with multi-select enabled. Each `tel` entry returned by the platform whose value normalizes successfully via `normalizePhone` SHALL be included in the contact's `phones` array with `value` set to the canonical international form. Entries whose value cannot be normalized SHALL NOT appear in `phones`; their trimmed raw value SHALL instead be appended to `rawPhoneNumbers`. The first parseable `tel` entry (in source order) SHALL be marked `isPrimary: true` in the deduplicated `phones` set (the Contact Picker API does not expose preference). `label` SHALL be `null` for every entry.

#### Scenario: User selects a contact with multiple phones

- **WHEN** the user selects a contact whose device record has two phone numbers
- **THEN** the composable SHALL return that contact with two `phones` entries, the first having `isPrimary: true` and the second `isPrimary: false`

#### Scenario: User selects a contact with one parseable phone

- **WHEN** the user selects a contact with a single parseable phone
- **THEN** `phones` SHALL contain one entry with the canonical international value and `isPrimary: true`

#### Scenario: User selects a contact with an unparseable phone

- **WHEN** the user selects a contact whose `tel` value cannot be parsed by `normalizePhone`
- **THEN** `phones` SHALL be empty AND `rawPhoneNumbers` SHALL contain the trimmed raw `tel` value

#### Scenario: User selects a contact with no phone

- **WHEN** a selected contact has no `tel` entries
- **THEN** `phones` SHALL be an empty array

#### Scenario: User cancels picker

- **WHEN** the user dismisses the native contact picker without selecting
- **THEN** the composable SHALL return an empty array

### Requirement: Import skips phones already held by another contact

Import persists phones only (emails are not persisted on import). The importer MUST
NOT insert, onto an imported contact, a phone value that already belongs to another
of the user's existing contacts. It SHALL skip the cross-contact duplicate phone
(rather than letting the per-user unique index reject the insert) and continue
importing the contact's remaining, non-duplicate phones.

#### Scenario: Imported contact reuses a number already on another contact
- **WHEN** an imported contact carries a phone that already exists on a different existing contact of the user
- **THEN** that phone is skipped for the imported contact and the import does not fail with a unique-violation

#### Scenario: Imported contact whose phones are all duplicates is skipped entirely
- **WHEN** every phone of an imported contact already exists on other contacts of the user
- **THEN** the contact is not created (no name-only orphan) and it is reported as skipped in the results

#### Scenario: Non-duplicate methods on the same imported contact still import
- **WHEN** an imported contact has one phone that duplicates another contact and one phone that is new
- **THEN** the duplicate is skipped and the new phone is imported onto the contact

### Requirement: Import results are presented as a grouped summary box

The import-results view MUST present outcomes as a summary box with distinct grouped
categories — at minimum: imported, skipped as already on another contact, and
unparseable — rather than a single bare "X skipped" label. Each non-empty category
SHALL show its count and enough context to identify what it refers to.

#### Scenario: Skipped cross-contact duplicates are reported in the summary
- **WHEN** an import skips one or more phones/emails because they already exist on other contacts
- **THEN** the results summary box shows a "already on another contact" category with the skipped count, distinct from the unparseable category

#### Scenario: Empty categories are omitted
- **WHEN** an import produces no unparseable and no skipped-duplicate entries
- **THEN** those categories are not rendered in the summary box

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

### Requirement: Import entry point states the accepted file format

The add-contact view SHALL render, adjacent to the import buttons and without requiring
any interaction, a statement of the accepted import format: vCard files with extension
`.vcf` or `.vcard`, one file per import, where a single file MAY contain multiple
contacts.

#### Scenario: User opens the add-contact view

- **WHEN** the add-contact view is rendered in its form state
- **THEN** the accepted-format statement SHALL be visible without expanding any disclosure and SHALL name both the `.vcf` and `.vcard` extensions

#### Scenario: File chooser offers vCard MIME types

- **WHEN** the hidden file input is rendered
- **THEN** its `accept` attribute SHALL include the extensions `.vcf` and `.vcard` AND the MIME types `text/vcard` and `text/x-vcard`, and it SHALL NOT carry the `multiple` attribute

### Requirement: Platform-specific export instructions behind a disclosure

The add-contact view SHALL provide collapsed-by-default export instructions, expandable
without navigating away from the view. The expanded content SHALL present three platform
tabs — iOS, Android and Desktop — implemented with `role="tablist"` / `role="tab"` and
`aria-selected` reflecting the active tab. Selecting a tab SHALL replace the displayed step
list with that platform's steps.

The iOS tab SHALL be active on first render for every user. The component SHALL NOT
inspect the user agent, touch-point count, or any platform capability to choose the active
tab.

#### Scenario: Disclosure is collapsed on first render

- **WHEN** the add-contact view is rendered
- **THEN** the export instructions SHALL NOT be visible and a labelled control to expand them SHALL be

#### Scenario: Active tab on first render

- **WHEN** the disclosure is expanded, on any platform
- **THEN** the iOS tab SHALL be active, the iOS steps SHALL be displayed, and the Android and Desktop tabs SHALL both be present and selectable

#### Scenario: User selects another platform

- **WHEN** a user selects a tab other than the active one
- **THEN** that tab SHALL become active, its `aria-selected` SHALL become `true`, the previous tab's SHALL become `false`, and the displayed steps SHALL be replaced with the selected platform's steps

#### Scenario: Android steps name both import paths

- **WHEN** the Android tab is displayed
- **THEN** the steps SHALL name the "Import from contacts" button as the one-tap path AND SHALL also give the `.vcf` export steps as a fallback, in both cases independently of whether the Contact Picker API is supported in the current browser

#### Scenario: Guidance is not duplicated outside the add view

- **WHEN** the contacts list is rendered, including its empty state
- **THEN** the export instructions and the accepted-format statement SHALL NOT be rendered there

### Requirement: File import failures are reported distinctly

`useVCardImport.parseVCardFile` SHALL validate its input and SHALL throw a
`VCardImportError` carrying a `reason` field of `'emptyFile'`, `'notVCard'` or
`'noContacts'` instead of returning an unusable result. The checks SHALL be evaluated in
that order.

- `emptyFile`: the file has zero bytes, or its text content is empty after trimming.
- `notVCard`: the text content contains no case-insensitive `BEGIN:VCARD` marker. This
  check SHALL be made against file *content*; a file SHALL NOT be rejected on the basis of
  its filename or extension.
- `noContacts`: the content parsed, but every contact produced is junk — carrying the
  `'Unknown'` name fallback with no `phones` and no `rawPhoneNumbers`.

`parseVCardText` SHALL remain pure and SHALL continue to return an empty array for input
containing no vCard blocks; it SHALL NOT throw.

The add-contact view SHALL map each `reason` to its own localized message, SHALL display it
on the add form, and SHALL NOT switch to the import-results view when a file import fails.
Each message SHALL state the corrective action, not only the failure.

#### Scenario: Empty file selected

- **WHEN** a user selects a file of zero bytes, or one whose content is only whitespace
- **THEN** `parseVCardFile` SHALL throw a `VCardImportError` with `reason: 'emptyFile'` AND the view SHALL remain on the add form displaying the empty-file message

#### Scenario: Non-vCard file selected

- **WHEN** a user selects a file whose content contains no `BEGIN:VCARD` marker (for example a CSV export or an image)
- **THEN** `parseVCardFile` SHALL throw a `VCardImportError` with `reason: 'notVCard'` AND the view SHALL remain on the add form displaying the not-a-vCard message

#### Scenario: vCard content in a file with an unexpected extension

- **WHEN** a user selects a file named without a `.vcf`/`.vcard` extension whose content does contain `BEGIN:VCARD`
- **THEN** the file SHALL be parsed normally and no `VCardImportError` SHALL be thrown

#### Scenario: vCard containing only nameless, phoneless cards

- **WHEN** a user selects a file whose every vCard block lacks `N`, `FN` and `TEL` (for example `ORG:`- or `NOTE:`-only cards)
- **THEN** `parseVCardFile` SHALL throw a `VCardImportError` with `reason: 'noContacts'` AND no contact named `'Unknown'` SHALL be created

#### Scenario: Mixed file with one usable contact

- **WHEN** a user selects a file containing one block with a name or phone and one nameless, phoneless block
- **THEN** no error SHALL be thrown and the import SHALL proceed with the parsed contacts

#### Scenario: Read failure is still reported generically

- **WHEN** reading the selected file rejects for a reason other than the three validated cases
- **THEN** the view SHALL display the existing generic `contacts.addDialog.fileImportError` message and SHALL remain on the add form

#### Scenario: Failed import does not advance the view

- **WHEN** any file import failure occurs
- **THEN** `addViewState` SHALL remain `'form'` AND no empty import-results summary SHALL be rendered

### Requirement: Import results screen is fully localized

Every user-facing string on the import-results view SHALL resolve through `vue-i18n` in
both `en` and `de-CH`. No literal English SHALL be embedded in the template or in a bound
expression.

#### Scenario: Extra phone count on a result row

- **WHEN** an imported contact carries more than one phone number
- **THEN** the additional-count indicator SHALL resolve from a localized, parameterized key rather than a literal `+N more`

#### Scenario: Unparseable-phone tooltip

- **WHEN** a result row carries `rawPhoneNumbers`
- **THEN** the tooltip listing them SHALL resolve from a localized, parameterized key rather than a literal `Couldn't parse: …`

### Requirement: Discarded phone numbers read differently on imported and skipped rows

A result row carrying `rawPhoneNumbers` SHALL phrase and colour that notice according to the
row's `status`. A skipped row SHALL keep the error wording and the error colour, because no
contact was created. An imported row SHALL use separate, milder wording and the warning
colour, because the contact exists and only the listed numbers were dropped.

#### Scenario: Contact skipped because no phone was usable

- **WHEN** a result row has `status: 'skipped'` and a non-empty `rawPhoneNumbers`
- **THEN** the notice SHALL resolve `contacts.list.invalidPhoneWarning` and SHALL render in the error colour

#### Scenario: Contact imported with some numbers discarded

- **WHEN** a result row has `status: 'imported'` and a non-empty `rawPhoneNumbers`
- **THEN** the notice SHALL resolve `contacts.addDialog.discardedPhones` and SHALL render in the warning colour, not the error colour

#### Scenario: Contact skipped as a duplicate

- **WHEN** a result row has `skipReason` of `'nameDuplicate'` or `'phoneDuplicate'`
- **THEN** no phone notice SHALL be rendered at all, regardless of `rawPhoneNumbers`, because the duplicate skip is the whole reason the row was not imported

#### Scenario: Re-importing the same file

- **WHEN** a file is imported a second time and every contact in it is skipped as a duplicate
- **THEN** the results list SHALL show only the skipped badges and the summary counts, with no error or warning notices on any row
