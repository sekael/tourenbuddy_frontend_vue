## ADDED Requirements

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
