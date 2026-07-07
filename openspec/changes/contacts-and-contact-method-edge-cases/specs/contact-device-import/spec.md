## ADDED Requirements

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
