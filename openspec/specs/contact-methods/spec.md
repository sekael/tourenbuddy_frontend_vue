## Purpose

Per-contact methods (phone numbers, email addresses) with labels, normalization, and primary-method selection.

## Requirements

### Requirement: Delete-phone confirmation warns about friendship and pending-request side effects

When the user initiates deletion of a phone `contact_method`, the confirmation UI MUST detect whether the phone value resolves to a registered user with whom (a) a pending `friend_requests` row and/or (b) a `friendships` row exists with the contact owner. If either applies, the confirmation MUST display a localized warning identifying the side effect (pending request cancellation, friendship removal, or both).

#### Scenario: Warning shown for linked phone with pending request
- **WHEN** the user opens the delete-phone confirmation for a phone whose value resolves to a registered user with a pending friend request (and no friendship)
- **THEN** the confirmation displays the localized "pending friend request will be cancelled" warning

#### Scenario: Warning shown for linked phone with existing friendship
- **WHEN** the user opens the delete-phone confirmation for a phone whose value resolves to a registered user with an existing friendship (and no pending request)
- **THEN** the confirmation displays the localized "existing friendship will be removed" warning

#### Scenario: Warning shown when both exist
- **WHEN** both a pending request and a friendship exist for the linked user
- **THEN** the confirmation displays the localized combined warning

#### Scenario: No warning for unlinked or unrelated phone
- **WHEN** the phone value does not resolve to a registered user, or resolves but no pending request and no friendship exist
- **THEN** the confirmation does not show the relationship warning

#### Scenario: Confirming the delete performs cleanup
- **WHEN** the user confirms phone-method deletion for which the warning was displayed
- **THEN** the phone method is deleted and the database removes the friendship and/or terminates the pending request (per the `friendships` capability)

### Requirement: Contact methods are written as part of the contact aggregate

There SHALL be no per-method repository or RPC. Every method mutation in the contacts store
(`addMethodToContact`, `updateMethodOnContact`, `setPrimaryPhoneOnContact`,
`removeMethodFromContact`) SHALL build the contact's whole desired method set, with
client-minted method ids, and write it through the single update seam
(`updateContactFull` → RPC `update_contact_full`), which reconciles the stored method set to
exactly that list in one transaction. New contacts SHALL be written the same way through
`create_contact_full`. Phone values SHALL be stored in E.164 form; `method_type` is
immutable server-side.

#### Scenario: Adding a method rewrites the aggregate

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value: '079 123 45 67' })` is called
- **THEN** the store SHALL call `update_contact_full` with the contact's existing methods plus a new method whose `value` is `+41791234567` and whose id was minted on the client

#### Scenario: Reconciliation removes methods absent from the list

- **WHEN** `update_contact_full` receives a method list that omits a stored method id
- **THEN** that stored method SHALL be deleted in the same transaction

#### Scenario: Offline method edits queue as one contact write

- **WHEN** a method is added, edited or removed while offline
- **THEN** the change SHALL be queued as one coalesced `contact` update entry and replayed as one `update_contact_full` call (see `offline-write-sync`)

### Requirement: Map contact-method unique-violations to friendly errors

The contacts repository SHALL detect Postgres error `code === '23505'` from the aggregate
write RPCs and SHALL map it to a typed error from `core/exceptions/`:
`contact_methods_unique_per_contact` → `DuplicateContactMethodError` (i18n key
`contacts.errors.duplicateMethod`), and `contact_methods_value_unique_per_user` →
`DuplicateContactAcrossContactsError` (i18n key `contacts.errors.duplicateAcrossContacts`).
The raw Postgres message and constraint name SHALL NOT be propagated to user-facing
snackbars. Both i18n keys SHALL exist in `en.json` and `de-CH.json`.

#### Scenario: Same value twice on one contact

- **WHEN** an aggregate write rejects with `code === '23505'` naming `contact_methods_unique_per_contact`
- **THEN** the repository SHALL throw `DuplicateContactMethodError`

#### Scenario: Value already on another contact

- **WHEN** an aggregate write rejects with `code === '23505'` naming `contact_methods_value_unique_per_user`
- **THEN** the repository SHALL throw `DuplicateContactAcrossContactsError`

#### Scenario: Other Postgres errors pass through unchanged

- **WHEN** an aggregate write rejects with any other error
- **THEN** the repository SHALL NOT map it

### Requirement: Single primary phone invariant

When a contact has one or more phone contact methods, exactly one SHALL have
`isPrimary = true`. The contacts store SHALL enforce this on every aggregate it builds, and
the database SHALL back it with the `contact_methods_one_primary_phone` partial unique index.

#### Scenario: First phone added becomes primary

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value, isPrimary: false })` is called and the contact has zero phone methods
- **THEN** the new phone SHALL be written with `isPrimary: true`

#### Scenario: Phone added as primary demotes the existing primary

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value, isPrimary: true })` is called and the contact already has a primary phone
- **THEN** the written aggregate SHALL mark every other phone `isPrimary: false` and the new phone `isPrimary: true`

#### Scenario: Phone added as non-primary keeps the existing primary

- **WHEN** `addMethodToContact` is called with `isPrimary: false` and the contact already has a primary phone
- **THEN** the new phone SHALL be written with `isPrimary: false` and the existing primary SHALL be unchanged

#### Scenario: Setting another phone primary

- **WHEN** `setPrimaryPhoneOnContact(contactId, methodId)` is called for a phone method
- **THEN** the written aggregate SHALL mark exactly that phone primary; a non-phone or unknown `methodId` SHALL throw without writing

#### Scenario: Removing the primary promotes the next phone

- **WHEN** `removeMethodFromContact(contactId, methodId)` removes the primary phone and other phones remain
- **THEN** the first remaining phone (by stored order) SHALL be written as primary

#### Scenario: Removing a non-primary phone leaves primary unchanged

- **WHEN** `removeMethodFromContact` removes a non-primary phone
- **THEN** no promotion SHALL occur

#### Scenario: Removing the only phone leaves no primary

- **WHEN** the last phone method of a contact is removed
- **THEN** no promotion occurs and the contact has zero phone methods

#### Scenario: Multiple phones added manually

- **WHEN** `addContact` is called with `source: 'manual'` and more than one phone
- **THEN** exactly one phone SHALL be marked primary, or the call SHALL throw without writing; with `source: 'import'` the primary SHALL instead be resolved from the phones' labels

### Requirement: Server row is the source of truth after a write

Online, the contacts store SHALL NOT change local state ahead of the write: it SHALL replace
the contact with the canonical row the aggregate RPC returns once the write succeeds.
Offline, the write SHALL be applied optimistically only after it is durably queued (see
`offline-write-sync`).

#### Scenario: Successful write adopts the server's aggregate

- **WHEN** `update_contact_full` succeeds online
- **THEN** the store SHALL replace the contact with the returned row, including its server `updatedAt`

#### Scenario: Rejected online write leaves local state untouched

- **WHEN** an online aggregate write rejects (for example with a duplicate-method error)
- **THEN** the contact in the store SHALL still show its previous methods and primary

### Requirement: Primary phone helper

A `getPrimaryPhone(contact)` utility function (`domain/entities/contact.ts`) SHALL extract the primary phone number from a contact's methods array, preferring the phone method explicitly marked `isPrimary = true` and falling back to the first phone method in insertion order when none is marked primary (legacy data).

#### Scenario: Contact has primary phone

- **WHEN** a contact has a contact method with `methodType: 'phone'` and `isPrimary: true`
- **THEN** `getPrimaryPhone` SHALL return that method's `value`

#### Scenario: Contact has multiple phones and one primary

- **WHEN** a contact has two phone methods where only the second has `isPrimary: true`
- **THEN** `getPrimaryPhone` SHALL return the second method's `value`

#### Scenario: Contact has no phone methods

- **WHEN** a contact has no contact methods with `methodType: 'phone'`
- **THEN** `getPrimaryPhone` SHALL return `null`

#### Scenario: Contact has phone but none primary (legacy)

- **WHEN** a contact has phone methods but none with `isPrimary: true`
- **THEN** `getPrimaryPhone` SHALL return the first phone method's `value` in insertion order
