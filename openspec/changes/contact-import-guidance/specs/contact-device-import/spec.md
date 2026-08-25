## ADDED Requirements

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
