## ADDED Requirements

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
