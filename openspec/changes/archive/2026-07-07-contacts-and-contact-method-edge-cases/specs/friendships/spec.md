## MODIFIED Requirements

### Requirement: Friendship requires both parties to retain the linking verified phone

A `friendships(A, B)` row SHALL only exist while BOTH parties satisfy all of:
- each party has a verified phone in `auth.users` (`phone_confirmed_at IS NOT NULL`);
- each party has the other in their `contacts` via a `contact_methods` row of `method_type = 'phone'` whose value resolves to the other party's verified phone.

When any of these conditions ceases to hold due to an actor's action (deleting a contact, deleting the linking phone `contact_method`, editing the linking phone `contact_method` to a different value, or deleting their own verified phone), the system MUST remove the `friendships` row.

#### Scenario: Friendship deleted when contact removed
- **WHEN** user A deletes a contact whose phone resolves to user B, and a `friendships(A, B)` row exists
- **THEN** that `friendships` row is deleted in the same transaction as the contact delete

#### Scenario: Friendship deleted when linking phone removed
- **WHEN** user A deletes a phone `contact_method` whose value resolves to user B, and a `friendships(A, B)` row exists
- **THEN** that `friendships` row is deleted in the same transaction as the contact_method delete

#### Scenario: Friendship deleted when linking phone edited to a different value
- **WHEN** user A updates a phone `contact_method` whose OLD value resolves to user B, changing it to a different value, and a `friendships(A, B)` row exists
- **THEN** that `friendships` row is deleted in the same transaction as the contact_method update, resolved from the OLD value

#### Scenario: Editing a phone that resolves to nobody leaves friendships untouched
- **WHEN** user A updates a phone `contact_method` whose OLD value resolves to no registered user
- **THEN** no `friendships` rows are modified

#### Scenario: Friendships deleted when user removes own verified phone
- **WHEN** user A invokes `delete_own_phone()` and `friendships` rows exist with A as `request_user_id` or `response_user_id`
- **THEN** all such `friendships` rows are deleted in the same transaction

### Requirement: Pending friend_requests terminated at every break-point

For each break-point (contact delete, linking-phone delete, linking-phone value edit, own-phone delete), the system MUST terminate pending `friend_requests` between the actor and every affected peer:
- Row with `from_user_id = actor` → `status = 'cancelled'`, `responded_at = now()`.
- Row with `to_user_id = actor` → `status = 'denied'`, `responded_at = now()`.
- Rows with `status` other than `'pending'` MUST NOT be modified.

For the linking-phone value edit, the affected peer is resolved from the OLD value of the edited `contact_method`.

#### Scenario: Outgoing pending cancelled when contact deleted
- **WHEN** user A deletes a contact whose phone resolves to user B and a pending row exists with `from_user_id = A, to_user_id = B`
- **THEN** the row's status becomes `'cancelled'` with `responded_at` set, in the same transaction

#### Scenario: Incoming pending denied when contact deleted
- **WHEN** user A deletes a contact whose phone resolves to user B and a pending row exists with `from_user_id = B, to_user_id = A`
- **THEN** the row's status becomes `'denied'` with `responded_at` set, in the same transaction

#### Scenario: Pending request terminated when linking phone removed
- **WHEN** user A deletes a phone `contact_method` whose value resolves to user B and a pending row exists between A and B
- **THEN** the pending row is terminated using the cancelled/denied rule based on direction

#### Scenario: Pending request terminated when linking phone edited to a different value
- **WHEN** user A updates a phone `contact_method` whose OLD value resolves to user B, changing it to a different value, and a pending row exists between A and B
- **THEN** the pending row is terminated using the cancelled/denied rule based on direction, resolved from the OLD value, in the same transaction as the update

#### Scenario: All caller-side pending requests terminated on own-phone delete
- **WHEN** user A invokes `delete_own_phone()` and pending `friend_requests` rows exist with A as `from_user_id` or `to_user_id`
- **THEN** every such row is terminated (cancelled if A was sender, denied if A was recipient)

#### Scenario: Non-pending requests untouched
- **WHEN** any break-point fires and a `friend_requests` row between the actor and peer has `status` in `{accepted, denied, cancelled}`
- **THEN** that row is not modified by the cleanup logic

#### Scenario: Editing a phone that does not change value is a no-op
- **WHEN** user A updates a phone `contact_method` row without changing its `value`
- **THEN** no `friend_requests` rows are modified by the edit break-point
