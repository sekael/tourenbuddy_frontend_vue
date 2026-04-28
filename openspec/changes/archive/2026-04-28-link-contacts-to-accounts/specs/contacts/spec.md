## ADDED Requirements

### Requirement: Contacts list shows friendship icon

The contacts list row SHALL render a friendship icon next to the contact name when the contact is linked to an accepted friend, per the rule defined in the `contact-account-linking` capability. Implementation SHALL consume `useFriendshipsStore().friendUserIds` and SHALL NOT introduce a separate source of truth for friendship status.

#### Scenario: Linked contact shows icon

- **WHEN** a contact's normalized phone matches a friend user_id in the friendships store
- **THEN** the list row SHALL render the friendship icon

#### Scenario: Unlinked contact has no icon

- **WHEN** none of a contact's phones match any friend user_id
- **THEN** the list row SHALL NOT render the friendship icon

### Requirement: Delete disclaimer for linked contacts

When a user initiates deletion of a contact that is linked to an accepted friendship (i.e. one of the contact's phones matches a friend user ID), the delete confirmation UI SHALL display a warning that the friendship connection will also be removed. Upon confirming deletion, the system SHALL remove the friendship via the `removeFriendship` store action before deleting the contact. The friend icon SHALL no longer appear for that contact once the friendship is removed.

#### Scenario: Linked contact — disclaimer shown

- **WHEN** a user taps delete on a contact whose phone is linked to a TourenBuddy friendship
- **THEN** the confirmation state SHALL display a warning message explaining the friendship will be removed

#### Scenario: Linked contact — friendship removed on delete

- **WHEN** the user confirms deletion of a linked contact
- **THEN** the system SHALL call `removeFriendship(linkedFriendUserId)` and then delete the contact, and the friend icon SHALL no longer appear in the contacts list

#### Scenario: Unlinked contact — no disclaimer

- **WHEN** a user taps delete on a contact with no linked friendship
- **THEN** the confirmation state SHALL NOT show any friendship-related warning

### Requirement: Contacts store unaffected by friendship state

The contacts store SHALL NOT store, fetch, or cache friendship state. Friendship lookups SHALL remain in the `useFriendshipsStore`. The contacts list component SHALL combine the two stores reactively at the presentation layer.

#### Scenario: No friendship fields on contact entity

- **WHEN** a contact entity is read from the store
- **THEN** the entity SHALL contain no friendship-status fields
