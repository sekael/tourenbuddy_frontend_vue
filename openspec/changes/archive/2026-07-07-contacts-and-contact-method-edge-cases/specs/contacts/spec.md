## ADDED Requirements

### Requirement: A contact method value is unique to one contact per user

A `contact_methods` value SHALL belong to at most one contact per user. The system
MUST enforce this at the database with a unique index over
`(user_id, method_type, value)` on `public.contact_methods`, covering both
`phone` and `email` method types. Phone values are compared in their stored
normalised E.164 form. This is in addition to the existing per-contact uniqueness
constraint.

#### Scenario: Second contact with the same phone is rejected by the DB
- **WHEN** a user inserts a `phone` `contact_method` whose normalised value already exists on another of that user's contacts
- **THEN** the insert fails with a unique-violation (`23505`) on the per-user index

#### Scenario: Same number across different users is allowed
- **WHEN** two different users each add a contact holding the same phone number
- **THEN** both inserts succeed (uniqueness is scoped per user, not globally)

#### Scenario: Pre-existing duplicates are collapsed before the index is built
- **WHEN** the migration runs and a `(user_id, method_type, value)` group has more than one row
- **THEN** the row with `is_primary = true` is kept if present, otherwise the lowest `id`, and the remaining duplicate rows are deleted
- **AND** any contact left with phone methods but no primary has its lowest-`id` phone set `is_primary = true`

### Requirement: Creating a contact with its methods is atomic

Creating a new contact together with its contact methods MUST be atomic: if any
method insert fails (including a per-user duplicate violation), the contact row MUST
NOT be persisted. No partial contact is ever created.

#### Scenario: Duplicate that slips past the pre-check leaves no orphan contact
- **WHEN** a new contact is created and one of its phones violates the per-user unique index at insert time
- **THEN** neither the contact row nor any of its methods are persisted, and the duplicate disclaimer is surfaced

### Requirement: A contact method's type is immutable

The system MUST reject any update that changes an existing `contact_methods` row's
`method_type`. Changing type in place would break a phone link (and its friend
relationship) without tripping the value-change break-point.

#### Scenario: Changing a method's type is rejected
- **WHEN** an update sets a `contact_methods` row's `method_type` to a different value
- **THEN** the update is rejected by the database

### Requirement: Adding a duplicate contact method surfaces an edit-instead disclaimer

The UI MUST show a disclaimer when a user attempts to add a contact or a contact
method whose value already exists on another of their contacts, stating the contact
could not be added because a contact with that value already exists, and offering
two actions: open the existing contact in edit mode, or discard. The value MUST NOT
be silently inserted onto a second contact.

#### Scenario: New contact blocked when any phone duplicates another contact
- **WHEN** the user submits the new-contact form and any one of its phones already belongs to another of their contacts
- **THEN** the whole save is blocked (no partial creation), and a disclaimer states the contact could not be added because a contact with that number already exists

#### Scenario: Edit-existing opens the conflicting contact in edit mode
- **WHEN** the user chooses "edit existing" on the disclaimer
- **THEN** the conflicting contact opens in edit mode and the in-progress draft is abandoned

#### Scenario: Discard abandons the whole draft
- **WHEN** the user chooses "discard" on the disclaimer
- **THEN** the entire in-progress contact draft is abandoned

#### Scenario: Duplicate detected when adding a method to an existing contact
- **WHEN** the user adds a phone/email to contact X that already exists on contact Y
- **THEN** the disclaimer is shown and the method is not added to contact X

#### Scenario: DB unique violation degrades to a generic disclaimer
- **WHEN** a duplicate slips past the client pre-check (e.g. stale local cache) and the insert returns a `23505` on the per-user index
- **THEN** the error is surfaced as a generic "already exists" disclaimer with a discard action only (the conflicting contact is not named), not a raw database error

### Requirement: Editing a phone method that links a friend/pending user warns before saving

The edit UI MUST show a warning, and MUST require explicit confirmation before
persisting the new value, when the user edits a phone `contact_method` whose current
(old) value resolves to a friend or to a user with a pending friend request — the
warning stating that saving will remove that friendship / cancel that pending request.

#### Scenario: Warning shown when the edited phone links a friend
- **WHEN** the user changes the value of a phone method whose old value resolves to a confirmed friend
- **THEN** a warning is shown and the update is not sent until the user confirms

#### Scenario: Warning shown when the edited phone links a pending request
- **WHEN** the user changes the value of a phone method whose old value resolves to a user with a pending request
- **THEN** a warning is shown and the update is not sent until the user confirms

#### Scenario: No warning when the edited phone links no relationship
- **WHEN** the user changes a phone value whose old value resolves to no friend and no pending request
- **THEN** the update is saved without a warning

#### Scenario: Duplicate check precedes the eviction warning
- **WHEN** the user edits a phone to a NEW value that duplicates another of their contacts, and the OLD value links a friend/pending user
- **THEN** the duplicate disclaimer is shown and the edit is stopped, and the friend-eviction warning is NOT shown (the edit cannot commit)

#### Scenario: Edit never auto-creates a relationship toward the new value
- **WHEN** the user edits a phone to a NEW value that resolves to a registered user who is not yet a friend
- **THEN** no friend request or friendship is created toward that user by the edit

### Requirement: A cancelled or blank add-method draft never blocks saving the contact

The form-level "save all" on the contact detail view MUST NOT fail because of an
add-method draft that was cancelled or left blank. A stale add-method error MUST be
cleared when the add-method form is cancelled, and the save's failure check MUST
only consider the add-method error while the add-method form is open.

#### Scenario: Cancel a blank add-method draft then save succeeds
- **WHEN** the user opens the add-method form, leaves it blank or triggers its required-value error, cancels it, then presses save on the contact
- **THEN** the contact saves successfully (no stale error), and the network responses being `200 OK` are reflected as success

#### Scenario: Blank add-method form is discarded on save
- **WHEN** the user presses "save all" with the add-method form open but its value empty
- **THEN** the empty draft is discarded and the rest of the contact saves without error

#### Scenario: An open add-method form with an invalid value still blocks save
- **WHEN** the user presses "save all" with the add-method form open and a non-empty but invalid value
- **THEN** the save is blocked and the add-method error is shown
