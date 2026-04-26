## ADDED Requirements

### Requirement: Contacts list shows friendship icon

The contacts list row SHALL render a friendship icon next to the contact name when the contact is linked to an accepted friend, per the rule defined in the `contact-account-linking` capability. Implementation SHALL consume `useFriendshipsStore().friendUserIds` and SHALL NOT introduce a separate source of truth for friendship status.

#### Scenario: Linked contact shows icon

- **WHEN** a contact's normalized phone matches a friend user_id in the friendships store
- **THEN** the list row SHALL render the friendship icon

#### Scenario: Unlinked contact has no icon

- **WHEN** none of a contact's phones match any friend user_id
- **THEN** the list row SHALL NOT render the friendship icon

### Requirement: Contacts store unaffected by friendship state

The contacts store SHALL NOT store, fetch, or cache friendship state. Friendship lookups SHALL remain in the `useFriendshipsStore`. The contacts list component SHALL combine the two stores reactively at the presentation layer.

#### Scenario: No friendship fields on contact entity

- **WHEN** a contact entity is read from the store
- **THEN** the entity SHALL contain no friendship-status fields
