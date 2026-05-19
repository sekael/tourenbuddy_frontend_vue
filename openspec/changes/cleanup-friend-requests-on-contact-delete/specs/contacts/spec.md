## ADDED Requirements

### Requirement: Delete-contact confirmation warns about friendship and pending-request side effects

When the user initiates contact deletion, the confirmation UI MUST detect whether deleting that contact will (a) cancel any pending `friend_requests` and/or (b) remove any existing `friendships` row between the current user and any registered user linked through the contact's phone `contact_methods`. If either applies, the confirmation dialog MUST display a localized warning identifying the side effect (pending request cancellation, friendship removal, or both).

#### Scenario: Warning shown when pending request exists
- **WHEN** the user opens the delete-contact confirmation for a contact whose phone resolves to a registered user with a pending friend request between the parties (and no friendship)
- **THEN** the confirmation dialog displays the localized "pending friend request will be cancelled" warning in addition to the standard delete message

#### Scenario: Warning shown when friendship exists
- **WHEN** the user opens the delete-contact confirmation for a contact whose phone resolves to a registered user with an existing friendship (and no pending request)
- **THEN** the confirmation dialog displays the localized "existing friendship will be removed" warning in addition to the standard delete message

#### Scenario: Warning shown when both exist
- **WHEN** both a pending request and a friendship exist for the contact's linked user
- **THEN** the confirmation dialog displays the localized combined warning

#### Scenario: No warning when no relationship
- **WHEN** the contact's phones do not resolve to a registered user, or resolve but no pending request and no friendship exist
- **THEN** the confirmation dialog shows only the standard delete message, with no relationship warning

#### Scenario: Confirming the delete performs cleanup
- **WHEN** the user confirms deletion of a contact for which the warning was displayed
- **THEN** the contact is deleted and the database removes the corresponding `friendships` row(s) and/or terminates pending `friend_requests` (per the `friendships` capability)
