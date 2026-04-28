## ADDED Requirements

### Requirement: Discovery prompt in manual contact form

When the user enters a phone number in the contact creation or edit form and the value normalizes to a valid E.164 number, the form SHALL (debounced ~400ms after blur or last keystroke) call `useFriendshipsStore().findUserByPhone(normalizedValue)`. When the result is a non-null user_id and that user is not already a friend and there is no pending outgoing request to that user, the form SHALL render an inline prompt next to the phone row: a short message ("This phone belongs to a TouringBuddy user — connect as friends?") and two actions: "Send request" and "Just save contact". The prompt SHALL be suppressed when the calling user's own phone is unverified.

#### Scenario: Match found, prompt shown

- **WHEN** the user enters a phone whose normalized form matches a verified user other than themselves and they are not already friends or pending
- **THEN** the inline connect prompt SHALL be rendered next to that phone row

#### Scenario: No match, no prompt

- **WHEN** `findUserByPhone` returns null
- **THEN** no prompt SHALL be rendered and the form SHALL behave normally

#### Scenario: User declines connection

- **WHEN** the user taps "Just save contact" on the prompt
- **THEN** the prompt SHALL be dismissed for that phone row, the form submit flow SHALL proceed normally, and no friend request SHALL be created

#### Scenario: User sends request

- **WHEN** the user taps "Send request" on the prompt
- **THEN** the friendships store SHALL call `sendRequest(matchedUserId)`, the prompt SHALL be replaced with a "Request sent" confirmation, and the contact save flow SHALL proceed normally

#### Scenario: Caller phone unverified suppresses prompt

- **WHEN** the calling user does not have `phone_confirmed_at` set
- **THEN** discovery SHALL NOT be invoked and no prompt SHALL be rendered

#### Scenario: Already friends suppresses prompt

- **WHEN** the matched user is already in the caller's `friendUserIds` set
- **THEN** no prompt SHALL be rendered

### Requirement: Discovery prompt in import results

The vCard / device-import results component SHALL, after parsing, batch-call `findUsersByPhones(uniquePhones)` once for the unique normalized phones across all parsed contacts. Result rows whose `phones` array contains a matched verified user (excluding the caller's own user_id) SHALL render the same inline connect prompt as the manual form, scoped to the row. The prompt SHALL be suppressed when the calling user's phone is unverified.

#### Scenario: Batch lookup runs once

- **WHEN** import-results renders N rows containing M unique normalized phones
- **THEN** exactly one batched `findUsersByPhones` call SHALL be made covering all M phones

#### Scenario: Matched row shows prompt

- **WHEN** an import result row's primary or any phone matches a verified user
- **THEN** the row SHALL render the inline connect prompt with "Send request" and "Just save contact" actions

#### Scenario: Multiple matched phones on one row

- **WHEN** a single result row matches more than one verified user (different phones, different accounts)
- **THEN** the row SHALL render one prompt per matched user, each independently actionable

#### Scenario: Sending request does not block import

- **WHEN** the user taps "Send request" on a matched row and then proceeds to import
- **THEN** the contact SHALL be imported as normal AND the friend request SHALL be sent independently

### Requirement: Self-match suppression

Discovery results matching the caller's own user_id SHALL never produce a prompt and SHALL never appear in match lists, regardless of which UI surface invoked discovery.

#### Scenario: Caller enters own phone

- **WHEN** the caller enters their own verified phone in a contact form
- **THEN** no prompt SHALL appear

### Requirement: Friendship icon in contacts list

A contact row in the contacts list SHALL display a Material Symbols `group` icon (or equivalent friendship glyph) when ANY of that contact's phone methods (normalized E.164) corresponds to a user_id present in `useFriendshipsStore().friendUserIds`. The icon SHALL be placed next to the contact name. No icon SHALL be shown for pending requests.

#### Scenario: Contact linked to a friend

- **WHEN** a contact has at least one phone method whose normalized value belongs to a user in the caller's friends set
- **THEN** the friendship icon SHALL be rendered on that contact's list row

#### Scenario: Contact not linked

- **WHEN** none of a contact's phone methods correspond to a friend user_id
- **THEN** no friendship icon SHALL be rendered on that row

#### Scenario: Pending request does not show icon

- **WHEN** a contact's phone matches a user with whom the caller has a pending request but no accepted friendship
- **THEN** no friendship icon SHALL be rendered

### Requirement: Phone-to-user resolution for icon mapping

The contacts presentation layer SHALL maintain a derived map `friendUserIdByContactId: Map<contactId, userId>` computed from the cross product of the contacts store's phone methods and the friendships store's friendships. Resolution SHALL match by normalized E.164 string equality. Recomputation SHALL occur reactively when either the contacts list or the friendships set changes.

#### Scenario: Contacts loaded after friendships

- **WHEN** the friendships store is populated and then the contacts store finishes loading
- **THEN** the derived map SHALL reflect all overlapping phones once both lists are available

#### Scenario: New friendship updates icon

- **WHEN** a friendship is added (e.g. after `accept`) and an existing contact's normalized phone matches the new friend's phone
- **THEN** the contact list row SHALL render the friendship icon without manual refresh

### Requirement: Connect prompt surfaces security context

The connect prompt (in both manual contact form and import results) SHALL include, in addition to the action buttons, a short, plain-language security note conveying:

1. The matched user's identity is not revealed beyond the existence of an account for the entered phone number.
2. Sending a request will notify the other user that the calling user has them in their contacts.
3. The other user may deny the request and is under no obligation to accept.

The note SHALL be visible without expanding any disclosure (no hidden "details" toggle for the core message). A "Learn more" affordance MAY link to a longer privacy/security explainer page.

#### Scenario: Note rendered with prompt

- **WHEN** a connect prompt is rendered (form or import-results)
- **THEN** the security note SHALL be visible above or adjacent to the action buttons

#### Scenario: Note translated per locale

- **WHEN** the prompt renders in `en` or `de-CH`
- **THEN** all note text SHALL be sourced from the locale files via `t()`

### Requirement: Friend-requests inbox surfaces deny right

The friend-requests inbox page SHALL display a persistent informational note communicating that the user is free to deny any incoming request without justification, that denial does not penalize the user in any way, and that denied requests do not notify the sender of the recipient's account ownership beyond the denial response itself. The Deny action SHALL be visually equivalent in prominence to the Accept action (no dark-pattern emphasis on Accept).

#### Scenario: Inbox shows deny-rights note

- **WHEN** the friend-requests inbox renders
- **THEN** the deny-rights note SHALL be visible regardless of whether requests are present

#### Scenario: Accept and Deny visually balanced

- **WHEN** an incoming request row renders
- **THEN** the Accept and Deny buttons SHALL be of equal visual weight (size, contrast); Deny SHALL NOT be hidden behind a secondary menu

### Requirement: i18n keys for linking and friendships

All user-facing strings introduced by this change SHALL be added under a `friendships.*` namespace in every locale file (`en.json`, `de-CH.json`) and rendered via `useI18n({ useScope: 'global' })`. Required keys include at minimum: prompt title, prompt body, prompt security note, send-request action, just-save-contact action, request-sent confirmation, learn-more link, inbox-empty state, inbox deny-rights note, accept action, deny action, cancel action, request-from label, request-to label, verification-notice title, verification-notice body, verification-notice acknowledge action.

#### Scenario: Missing locale key fails CI

- **WHEN** a string is added to one locale but not another
- **THEN** the i18n lint/check SHALL fail and the change SHALL NOT merge
