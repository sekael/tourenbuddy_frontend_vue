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

### Requirement: addContact accepts emails for import flows

The contacts store's `addContact` action SHALL accept an optional `emails: string[]` argument. After phones are inserted, each email SHALL be inserted as an `email` contact method via `contactMethodsRepository.addMethod`. Emails SHALL be deduplicated by lowercase-trim comparison before insertion. The first email in input order SHALL be inserted with `isPrimary: true`; remaining emails SHALL be inserted with `isPrimary: false`. If both `phones` and `emails` are non-empty, both arrays SHALL be inserted in full (no method-type interaction). Existing callers that omit `emails` SHALL behave identically to today.

#### Scenario: addContact called with emails only

- **WHEN** `addContact(firstName, lastName, displayName, phones: [], source: 'import', emails: ['friend@example.com', 'other@example.com'])` is called
- **THEN** the repository SHALL insert two `email` contact methods AND zero phone methods, with the first email having `isPrimary: true`

#### Scenario: addContact called with phones and emails

- **WHEN** `addContact` is called with one phone and one email
- **THEN** one `phone` method and one `email` method SHALL be inserted, each marked `isPrimary: true` within its method type

#### Scenario: Email dedupe before insertion

- **WHEN** `addContact` is called with `emails: ['Foo@Example.com', 'foo@example.com']`
- **THEN** exactly one `email` method SHALL be inserted with `value: 'foo@example.com'`

#### Scenario: addContact called without emails argument (existing callers)

- **WHEN** `addContact` is called without the `emails` argument
- **THEN** behavior SHALL match today (only phones, if any, are inserted)

### Requirement: Map contact-method unique-violation to friendly error

The `ContactMethodsRepository` and any repository path that inserts into `contact_methods` SHALL detect Postgres error `code === '23505'` originating from constraint `contact_methods_unique_per_contact` and SHALL throw a typed `DuplicateContactMethodError` (in `core/exceptions/`) carrying the i18n key `contacts.errors.duplicateMethod`. The raw Postgres message and constraint name SHALL NOT be propagated to user-facing snackbars. The i18n key SHALL exist in both `en.json` and `de-CH.json` with a human-readable message.

#### Scenario: Unique-violation surfaced as typed error

- **WHEN** an insert into `contact_methods` rejects with Postgres `code === '23505'` and `constraint === 'contact_methods_unique_per_contact'`
- **THEN** the repository SHALL throw `DuplicateContactMethodError` whose message resolves via i18n key `contacts.errors.duplicateMethod`

#### Scenario: Other Postgres errors pass through unchanged

- **WHEN** an insert into `contact_methods` rejects with a non-`23505` error
- **THEN** the repository SHALL NOT map the error and SHALL propagate it unchanged

#### Scenario: i18n keys present in all locales

- **WHEN** the locale bundles are loaded
- **THEN** `contacts.errors.duplicateMethod`, `contacts.errors.noValidPhone`, and `contacts.errors.someInvalidPhonesDiscarded` SHALL be defined in both `en.json` and `de-CH.json`

### Requirement: Single primary phone invariant

When a contact has one or more phone contact methods, exactly one SHALL have `isPrimary = true`. The application layer (Pinia store + repository helper) SHALL enforce this invariant on every write that adds, updates, or removes a phone method.

#### Scenario: First phone added becomes primary

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value, isPrimary: false })` is called and the contact has zero phone methods
- **THEN** the store SHALL override `isPrimary` to `true` before calling the repository

#### Scenario: Second phone added with isPrimary=true demotes existing primary

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value, isPrimary: true })` is called and the contact already has a primary phone
- **THEN** the existing primary phone's `is_primary` SHALL be set to `false` and the new phone SHALL be inserted with `is_primary = true`

#### Scenario: Second phone added with isPrimary=false keeps existing primary

- **WHEN** `addMethodToContact(contactId, { methodType: 'phone', value, isPrimary: false })` is called and the contact already has a primary phone
- **THEN** the new phone SHALL be inserted with `is_primary = false` and the existing primary SHALL be unchanged

#### Scenario: Removing the primary promotes next phone

- **WHEN** `removeMethodFromContact(contactId, methodId)` is called with the current primary phone's id and the contact has additional phone methods
- **THEN** after removal the store SHALL call `setPrimaryPhone` with the id of the next remaining phone method (by insertion order) so exactly one phone remains primary

#### Scenario: Removing a non-primary phone leaves primary unchanged

- **WHEN** `removeMethodFromContact` is called with a non-primary phone's id
- **THEN** no primary promotion SHALL occur

#### Scenario: Removing the only phone leaves no primary

- **WHEN** the last phone method of a contact is removed
- **THEN** no promotion occurs and the contact has zero phone methods

### Requirement: ContactMethodsRepository setPrimaryPhone is transactional

The `ContactMethodsRepository` SHALL expose `setPrimaryPhone(contactId, methodId)` backed by a Supabase RPC (Postgres function) that executes both the clear-siblings UPDATE and the set-target UPDATE inside a single database transaction. On any failure (invalid id, RLS violation, method not a phone, method belongs to a different contact), the transaction SHALL roll back so the previously primary phone remains primary.

#### Scenario: Flip primary between two phones — success

- **WHEN** `setPrimaryPhone(contactId, newPrimaryId)` is called and the contact has another phone method with `is_primary = true`
- **THEN** inside one transaction the DB SHALL set `is_primary = false` on every other phone method of the contact and set `is_primary = true` on `newPrimaryId`
- **AND** the repository SHALL resolve with the updated rows

#### Scenario: Target method id does not exist — rollback

- **WHEN** `setPrimaryPhone(contactId, methodId)` is called with a `methodId` that does not belong to `contactId` or is not of type phone
- **THEN** the transaction SHALL roll back and no row's `is_primary` value SHALL change
- **AND** the repository SHALL reject with an error

#### Scenario: RPC rejection preserves previous primary

- **WHEN** the `setPrimaryPhone` RPC call rejects for any reason
- **THEN** a subsequent fetch of the contact SHALL show the same phone method as primary as before the call

#### Scenario: Setting primary on already-primary method

- **WHEN** `setPrimaryPhone(contactId, methodId)` is called where `methodId` is already the primary
- **THEN** after the call the contact still has exactly one primary phone equal to `methodId`

### Requirement: Database is source of truth for primary

The `contact_methods.is_primary` column in Supabase SHALL be the authoritative value for whether a contact method is primary. The client store SHALL NOT mutate local `isPrimary` state ahead of a successful repository write. When a write to change primary status fails, the local state SHALL remain aligned with the last known DB state.

#### Scenario: Failed primary change does not alter local state

- **WHEN** the user selects a non-primary phone as primary and the repository call rejects
- **THEN** the contacts store `contacts` array SHALL continue to show the previously primary phone as primary

#### Scenario: Successful primary change updates local state from repository response

- **WHEN** the repository call to change primary succeeds
- **THEN** the store SHALL update local `isPrimary` flags using the returned rows (not pre-computed values)

## MODIFIED Requirements

### Requirement: Primary phone helper

A `getPrimaryPhone(contact)` utility function SHALL extract the primary phone number from a contact's methods array, preferring the phone method explicitly marked `isPrimary = true` and falling back to the first phone method in insertion order when none is marked primary (legacy data).

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

### Requirement: ContactMethods repository

A `ContactMethodsRepository` interface SHALL provide methods to add, update, remove, and re-order primary status of contact methods in the `contact_methods` table.

#### Scenario: Add phone method

- **WHEN** `addMethod(contactId, { methodType: 'phone', value: '+41 79 123 45 67', isPrimary: true })` is called
- **THEN** the repository SHALL INSERT into `contact_methods` and return the created row

#### Scenario: Remove method

- **WHEN** `removeMethod(methodId)` is called
- **THEN** the repository SHALL DELETE the row from `contact_methods`

#### Scenario: Set primary phone

- **WHEN** `setPrimaryPhone(contactId, methodId)` is called
- **THEN** the repository SHALL clear `is_primary` on sibling phone methods of the same contact, then set `is_primary = true` on the target method
