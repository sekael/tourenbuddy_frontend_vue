## ADDED Requirements

### Requirement: Connect prompt gates send on pre-send hook

The connect prompt component SHALL accept an optional caller-supplied async pre-send hook. When the user activates "Send request", the component SHALL await the hook before invoking `useFriendshipsStore().sendRequest`. If the hook rejects (e.g. validation failure, persistence failure), the component SHALL NOT call `sendRequest`, SHALL remain in its pre-send state with the action buttons re-enabled, and SHALL surface the rejection's error message in the prompt's existing error region. When the hook resolves, the send SHALL proceed as today.

If no hook is supplied, the component SHALL preserve its current behavior and invoke `sendRequest` directly.

#### Scenario: Hook resolves — send proceeds

- **WHEN** the caller provides a hook that resolves and the user taps Send request
- **THEN** the component SHALL await the hook to completion, then call `sendRequest(matchedUserId)` and render the "Request sent" confirmation

#### Scenario: Hook rejects — send aborted

- **WHEN** the caller provides a hook that rejects with an error and the user taps Send request
- **THEN** the component SHALL NOT call `sendRequest`, SHALL surface the error message inline, and SHALL leave the action buttons interactive for retry

#### Scenario: No hook — current behavior preserved

- **WHEN** no hook is provided and the user taps Send request
- **THEN** the component SHALL call `sendRequest` directly without an intermediate await

### Requirement: Detail-view connect prompt commits pending edits before sending

The contact detail view SHALL pass a pre-send hook to its connect prompt that commits any pending edit-mode changes to the contact before the friend request is sent. The hook SHALL be a no-op when the detail view is in view mode (nothing dirty to persist). If the contact is in edit mode and Save fails, the hook SHALL reject so the connect prompt aborts the send. On a successful commit, the detail view SHALL return to view mode reflecting the persisted state.

#### Scenario: Send request from view mode

- **WHEN** the detail view is in view mode and the user taps Send request on the prompt
- **THEN** the pre-send hook SHALL resolve immediately and the request SHALL be sent

#### Scenario: Send request from edit mode — save succeeds

- **WHEN** the detail view is in edit mode with dirty fields and the user taps Send request
- **THEN** the pending edits SHALL be persisted, the detail view SHALL return to view mode, and the friend request SHALL then be sent

#### Scenario: Send request from edit mode — save fails

- **WHEN** the detail view is in edit mode and at least one field's save fails when Send request is tapped
- **THEN** the friend request SHALL NOT be sent, the detail view SHALL stay in edit mode with field-level errors, and the connect prompt SHALL surface the failure inline

## MODIFIED Requirements

### Requirement: Discovery prompt in manual contact form

When the user enters a phone number in the contact creation or edit form and the value normalizes to a valid E.164 number, the form SHALL (debounced ~400ms after blur or last keystroke) call `useFriendshipsStore().findUserByPhone(normalizedValue)`. When the result is a non-null user_id and that user is not already a friend and there is no pending outgoing request to that user, the form SHALL render an inline prompt next to the phone row: a short message ("This phone belongs to a TouringBuddy user — connect as friends?") and two actions: "Send request" and "Just save contact". The prompt SHALL be suppressed when the calling user's own phone is unverified.

The manual-add flow SHALL pass a pre-send hook to the connect prompt that submits the contact form (running validation and persistence) before the friend request is sent. If form submission fails (validation error or persistence error) the hook SHALL reject so that the connect prompt aborts the send and the form's existing error surfaces are responsible for displaying the failure.

#### Scenario: Match found, prompt shown

- **WHEN** the user enters a phone whose normalized form matches a verified user other than themselves and they are not already friends or pending
- **THEN** the inline connect prompt SHALL be rendered next to that phone row

#### Scenario: No match, no prompt

- **WHEN** `findUserByPhone` returns null
- **THEN** no prompt SHALL be rendered and the form SHALL behave normally

#### Scenario: User declines connection

- **WHEN** the user taps "Just save contact" on the prompt
- **THEN** the prompt SHALL be dismissed for that phone row, the form submit flow SHALL proceed normally, and no friend request SHALL be created

#### Scenario: User sends request — form submitted first

- **WHEN** the user taps "Send request" on the prompt while the manual contact form has unsaved input
- **THEN** the contact form SHALL be submitted first, and only after submission succeeds SHALL the friendships store call `sendRequest(matchedUserId)` and the prompt be replaced with a "Request sent" confirmation

#### Scenario: Form submission fails — send aborted

- **WHEN** the user taps "Send request" and the contact form submission fails (validation or persistence)
- **THEN** the friend request SHALL NOT be sent, the form SHALL display its validation/persistence errors, and the connect prompt SHALL surface the failure inline

#### Scenario: Caller phone unverified suppresses prompt

- **WHEN** the calling user does not have `phone_confirmed_at` set
- **THEN** discovery SHALL NOT be invoked and no prompt SHALL be rendered

#### Scenario: Already friends suppresses prompt

- **WHEN** the matched user is already in the caller's `friendUserIds` set
- **THEN** no prompt SHALL be rendered
