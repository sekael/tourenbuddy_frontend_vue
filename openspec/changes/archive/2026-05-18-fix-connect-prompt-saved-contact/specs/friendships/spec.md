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
