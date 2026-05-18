## Why

Issue #158: In the contact detail view for an already-saved contact, the `ConnectPrompt` tile renders both a "Save contact only" and a "Send friend request" button. The "Save contact only" action is meaningless when the contact is already persisted and no edits are pending, cluttering the UI and confusing users.

## What Changes

- `ConnectPrompt` gains a boolean `show-dismiss` prop (default `true`, preserving current call-sites in add/import flows).
- `ContactDetailView` exposes its `mode` ref (`'view' | 'edit'`) via `defineExpose` so the parent can react to edit-mode transitions.
- `contacts-list-sheet.vue` passes `:show-dismiss="detailMode === 'edit'"` to the detail-view `ConnectPrompt` instance. View mode → only "Send friend request"; edit mode → both buttons (existing `beforeSend` commits pending edits before sending).

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `friendships`: ConnectPrompt button set becomes context-aware via a new prop; default behavior unchanged.

## Impact

- `src/features/friendships/presentation/components/connect-prompt.vue` — add prop, conditional render of dismiss button.
- `src/features/contacts/presentation/components/contact-detail-view.vue` — expose `mode`.
- `src/features/contacts/presentation/components/contacts-list-sheet.vue` — wire prop to detail-view ConnectPrompt.
- Tests: friendships ConnectPrompt component test for the new prop.
- No DB, no API, no i18n keys added (button reuses existing keys).
