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

### Requirement: Resolve friend names via get_user_names_by_ids RPC
The system SHALL expose a Supabase RPC `public.get_user_names_by_ids(p_user_ids uuid[])` returning `(user_id, first_name, last_name)` rows from `public.user_profile`. The function SHALL be SECURITY DEFINER with `search_path = ''`. It MUST disclose a row only when the caller has a confirmed phone AND at least one of:
- A row in `public.friendships` links caller and target in either direction, OR
- A row in `public.friend_requests` with `status = 'pending'`, `from_user_id = target`, `to_user_id = caller` (i.e., caller is the recipient of a pending request from target).

Pending requests in the other direction (caller is sender) MUST NOT disclose the target's name. EXECUTE SHALL be granted to `authenticated`.

#### Scenario: Caller is confirmed friend of target
- **WHEN** an authenticated, phone-verified user calls `get_user_names_by_ids([friend_id])` and a `friendships` row links them
- **THEN** the RPC returns one row with that friend's `first_name` and `last_name` from `user_profile`

#### Scenario: Caller is recipient of pending request from target
- **WHEN** the caller has a pending `friend_requests` row where `from_user_id = target` and `to_user_id = caller`
- **THEN** the RPC returns the target's name row

#### Scenario: Caller is sender of pending request to target
- **WHEN** the caller has a pending `friend_requests` row where `from_user_id = caller` and `to_user_id = target` and no friendship exists
- **THEN** the RPC returns no row for that target

#### Scenario: Caller is not phone-verified
- **WHEN** an authenticated user without `phone_confirmed_at` calls the RPC
- **THEN** the RPC returns zero rows regardless of the requested IDs

#### Scenario: Target profile has null first_name
- **WHEN** the caller is a confirmed friend of a target whose `user_profile.first_name` is null
- **THEN** the RPC returns a row with `first_name = null`, `last_name` as stored

### Requirement: Friend-request inbox displays name with phone
The friend-requests inbox SHALL render each request row with the counterparty's display name on the primary line and the counterparty's phone number on a secondary line styled in a lighter color (smaller font + `--color-on-surface-variant`) so the user can cross-check the number.

For incoming requests, the display name SHALL be derived from `userIdToNamesMap` (populated via `get_user_names_by_ids`), joining first and last name with a single space and trimming. When the resolved name is null or empty, the row SHALL fall back to rendering the formatted phone as the primary line and omit the secondary line to avoid duplication.

For outgoing requests, the display name SHALL be derived from the caller's local contacts: any contact whose `contactMethods` include the recipient's phone supplies its `firstName` (+ ` lastName` when present) as the primary line. When no local contact matches, the row SHALL fall back to rendering the formatted phone as the primary line and omit the secondary line.

#### Scenario: Incoming row with resolved profile name
- **WHEN** `userIdToNamesMap` contains `{firstName: "Ada", lastName: "Lovelace"}` for the requester
- **THEN** the row renders "Ada Lovelace" on the primary line and the formatted phone on a lighter secondary line

#### Scenario: Incoming row with null profile name
- **WHEN** the RPC returned `{firstName: null, lastName: null}` for the requester
- **THEN** the row renders the formatted phone on the primary line and no secondary line

#### Scenario: Outgoing row with matching local contact
- **WHEN** the sender's `contacts` store contains a contact whose contact methods include the recipient's phone with name "Bob Stewart"
- **THEN** the row renders "Bob Stewart" on the primary line and the formatted phone on a lighter secondary line

#### Scenario: Outgoing row without matching local contact
- **WHEN** no local contact matches the recipient's phone
- **THEN** the row renders the formatted phone on the primary line and no secondary line

### Requirement: Friendship repository exposes getNamesByUserIds
The `FriendshipRepository` interface and its Supabase implementation SHALL expose `getNamesByUserIds(userIds: string[]): Promise<Array<{ userId: string, firstName: string | null, lastName: string | null }>>`. The implementation SHALL short-circuit and return `[]` when the input array is empty, and SHALL throw on RPC error.

#### Scenario: Empty input
- **WHEN** `getNamesByUserIds([])` is invoked
- **THEN** the repository returns `[]` without calling Supabase

#### Scenario: RPC returns error
- **WHEN** `supabase.rpc('get_user_names_by_ids', ...)` resolves with an `error`
- **THEN** the repository throws the error

### Requirement: Friendships store caches resolved names
The friendships Pinia store SHALL expose a `userIdToNamesMap` reactive `Map<string, { firstName: string | null, lastName: string | null }>` and a `getNamesByUserIds(ids)` action that populates the map from the RPC. The action SHALL skip the network call when no input IDs are missing from the map and when the caller is not phone-verified.

#### Scenario: All requested ids already cached
- **WHEN** every requested ID is already a key in `userIdToNamesMap`
- **THEN** the store SHALL NOT call the repository

#### Scenario: Caller not phone-verified
- **WHEN** the current user lacks `phone_confirmed_at` and `getNamesByUserIds` is invoked
- **THEN** the store returns without calling the repository

### Requirement: Accept flow creates contact with profile name
After `friendships-store.accept(requestId)` resolves successfully, the friend-requests inbox SHALL resolve the requester's first/last name via `getNamesByUserIds` and create the auto-contact via `contactsStore.addContact(firstName, lastName, null, [{ value: phone, isPrimary: true }])`. When the resolved `firstName` is null or empty after trimming, the inbox SHALL fall back to the formatted phone as `firstName` and `null` as `lastName`. When a contact already has the phone in its contact methods, no new contact SHALL be created.

#### Scenario: Profile has first and last name
- **WHEN** accept resolves and the RPC returns `{ firstName: "Ada", lastName: "Lovelace" }`
- **THEN** `addContact` is called with `("Ada", "Lovelace", null, [{ value: phone, isPrimary: true }])`

#### Scenario: Profile first_name is null
- **WHEN** the RPC returns `{ firstName: null, lastName: null }`
- **THEN** `addContact` is called with `(formattedPhone, null, null, [{ value: phone, isPrimary: true }])`

#### Scenario: Contact for phone already exists
- **WHEN** the user already has a contact whose contact methods include the requester's phone
- **THEN** the accept flow does NOT call `addContact`

### Requirement: Notify on friend request created
After a friendship row is successfully inserted via the send-request flow, the friendships store SHALL invoke the notifications dispatch for `friend_request_received` targeting the recipient. The send-request UI (`connect-prompt.vue`) SHALL display a security note that informs the sender that (a) their identity is not revealed beyond account existence, (b) the recipient may deny without stating a reason, (c) friendships cannot be deleted, AND (d) the sender's first and last name will become visible to the recipient once the request is accepted.

#### Scenario: Successful send
- **WHEN** the user sends a friend request and the insert succeeds
- **THEN** the store calls the notifications Worker `/notify/friend-request-received` with the new `friendshipId` and continues regardless of the dispatch result

#### Scenario: Insert fails
- **WHEN** the insert fails
- **THEN** no notification dispatch is attempted

#### Scenario: Send-request UI shows name-visibility disclosure
- **WHEN** the user opens the connect-prompt
- **THEN** the rendered security note includes a sentence stating the sender's first and last name will be visible to the recipient after acceptance

### Requirement: Notify on friend request responded
After the recipient accepts or declines a friend request, the friendships store SHALL invoke the notifications dispatch for `friend_request_responded` targeting the original sender. The accept-confirmation UI SHALL warn the recipient that accepted friendships cannot be deleted directly and require deleting the linked contact. The accept-confirmation UI MUST NOT disclose any identity attribute of the requester beyond what is already visible in the inbox (i.e., the requester's phone number).

#### Scenario: Accept
- **WHEN** the recipient accepts the request and the update succeeds
- **THEN** the store calls `/notify/friend-request-responded` with the `friendshipId`

#### Scenario: Decline
- **WHEN** the recipient declines the request and the update succeeds
- **THEN** the store calls `/notify/friend-request-responded` with the `friendshipId`

#### Scenario: Update fails
- **WHEN** the update fails
- **THEN** no notification dispatch is attempted

#### Scenario: Accept resolves
- **WHEN** `accept(requestId)` completes successfully
- **THEN** the store invokes `notifyFriendRequestResponded(requestId)`

#### Scenario: Deny resolves
- **WHEN** `deny(requestId)` completes successfully
- **THEN** the store invokes `notifyFriendRequestResponded(requestId)`
