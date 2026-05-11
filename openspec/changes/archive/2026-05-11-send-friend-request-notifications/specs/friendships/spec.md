## ADDED Requirements

### Requirement: Notify on friend request created
After a friendship row is successfully inserted via the send-request flow, the friendships store SHALL invoke the notifications dispatch for `friend_request_received` targeting the recipient.

#### Scenario: Successful send
- **WHEN** the user sends a friend request and the insert succeeds
- **THEN** the store calls the notifications Worker `/notify/friend-request-received` with the new `friendshipId` and continues regardless of the dispatch result

#### Scenario: Insert fails
- **WHEN** the insert fails
- **THEN** no notification dispatch is attempted

### Requirement: Notify on friend request responded
After the recipient accepts or declines a friend request, the friendships store SHALL invoke the notifications dispatch for `friend_request_responded` targeting the original sender.

#### Scenario: Accept
- **WHEN** the recipient accepts the request and the update succeeds
- **THEN** the store calls `/notify/friend-request-responded` with the `friendshipId`

#### Scenario: Decline
- **WHEN** the recipient declines the request and the update succeeds
- **THEN** the store calls `/notify/friend-request-responded` with the `friendshipId`

#### Scenario: Update fails
- **WHEN** the update fails
- **THEN** no notification dispatch is attempted
