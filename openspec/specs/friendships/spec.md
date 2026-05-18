## ADDED Requirements

### Requirement: ConnectPrompt dismiss button visibility
The `ConnectPrompt` component SHALL accept a boolean `show-dismiss` prop (default `true`) that controls whether the secondary "Save contact only" / dismiss button is rendered. When `show-dismiss` is `false`, only the primary "Send friend request" button SHALL be rendered.

#### Scenario: Saved contact detail view, not editing
- **WHEN** `ConnectPrompt` is rendered in the contact detail view for an already-saved contact whose detail view is in `mode === 'view'`
- **THEN** `show-dismiss` is `false` and only the "Send friend request" button is visible

#### Scenario: Saved contact detail view, editing
- **WHEN** `ConnectPrompt` is rendered in the contact detail view and the detail view enters `mode === 'edit'`
- **THEN** `show-dismiss` becomes `true` and both buttons are visible so the user can either commit pending edits without sending a request or commit edits and send the request

#### Scenario: Add-contact and import flows preserve default
- **WHEN** `ConnectPrompt` is rendered without an explicit `show-dismiss` prop (manual add form, vCard import results)
- **THEN** both the dismiss and send buttons are visible, matching prior behavior

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
