## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/21-link-contacts-to-accounts`

## 2. Database Migration

- [x] 2.1 Add Supabase migration creating `friend_requests` table (columns + check constraint + unique partial index on pending pair)
- [x] 2.2 Same migration creates `friendships` table with composite PK and `user_a_id < user_b_id` check constraint
- [x] 2.3 Add RLS policies for `friend_requests`: SELECT (sender or recipient), INSERT (sender = auth.uid AND both phones verified), UPDATE recipient (pending → accepted/denied), UPDATE sender (pending → cancelled)
- [x] 2.4 Add RLS policies for `friendships`: SELECT only when caller is `user_a_id` or `user_b_id`; deny all client INSERT/UPDATE/DELETE
- [x] 2.5 Create SECURITY DEFINER function `find_user_by_phone(text) returns uuid` — caller verified-phone gate, exact E.164 match against `auth.users.phone` with `phone_confirmed_at IS NOT NULL`, exclude caller's own user_id
- [x] 2.6 Create SECURITY DEFINER function `find_users_by_phones(text[]) returns table(phone text, user_id uuid)` with same gating
- [x] 2.7 Create SECURITY DEFINER function `accept_friend_request(uuid)` performing transactional update + ordered-pair insert into `friendships`; idempotent on already-accepted; rejects non-recipient caller
- [x] 2.8 Apply migration locally; verify policies and functions with manual SQL test cases (verified caller, unverified caller, self-match, duplicate pending)

## 3. Domain & Data Layers (features/friendships)

- [x] 3.1 Create `features/friendships/` directory tree (data/domain/presentation per project DDD layout)
- [x] 3.2 Define Zod schemas for `FriendRequest` (id, fromUserId, toUserId, status, createdAt, respondedAt) and `Friendship` (userAId, userBId, createdAt, requestId)
- [x] 3.3 Define domain entities and abstract `FriendshipRepository` interface (sendRequest, accept, deny, cancel, listIncoming, listOutgoing, listFriendships, findUserByPhone, findUsersByPhones)
- [x] 3.4 Implement Supabase `FriendshipRepositoryImpl` calling tables and RPCs; map rows through Zod schemas
- [x] 3.5 Add custom exceptions in `core/exceptions/` for friendship errors if needed (e.g., `UnverifiedPhoneError`, `FriendshipExistsError`)

## 4. Pinia Store

- [x] 4.1 Create `useFriendshipsStore` (composition setup) with `incomingRequests`, `outgoingRequests`, `friendships`, `isLoading`, `error` refs
- [x] 4.2 Implement actions: `fetchAll`, `sendRequest`, `accept`, `deny`, `cancel`, `findUserByPhone`, `findUsersByPhones`
- [x] 4.3 Implement `friendUserIds` computed getter returning `Set<string>`
- [x] 4.4 Subscribe to auth store: fetch on authenticated AND verified, clear on sign-out, react to `phone_confirmed_at` transition
- [x] 4.5 Optimistic updates for sendRequest, accept, deny, cancel

## 5. Connect Prompt UI

- [x] 5.1 Create `features/friendships/presentation/components/ConnectPrompt.vue` taking `matchedUserId` prop and emitting `sent`/`dismissed`
- [x] 5.2 Wire prompt state machine: idle → sending → sent OR error
- [x] 5.3 Render security note in prompt body (identity not revealed beyond account existence; sending notifies other user; recipient may deny). Optional "Learn more" link to privacy explainer.
- [x] 5.4 Integrate prompt into manual contact form (`features/contacts/presentation/components/...`): debounced (~400ms) `findUserByPhone` on phone field input/blur for valid E.164; render prompt inline; suppress when caller unverified, already friend, or pending request exists
- [x] 5.5 Suppress prompt for caller's own phone (extra defensive client-side check)

## 6. Import Results Integration

- [x] 6.1 In import-results component, after parse: collect unique normalized phones, single batch call `findUsersByPhones`
- [x] 6.2 Render `ConnectPrompt` per matched row (one per matched user when multiple matches on a row)
- [x] 6.3 Ensure import flow does not block on request send and vice versa; surface failures via snackbar
- [x] 6.4 Suppress all discovery + prompts when caller is unverified

## 7. Contacts List Friendship Icon

- [x] 7.1 In contacts list row component, compute icon visibility from `friendUserIds` cross-product over normalized contact phones
- [x] 7.2 Render Material Symbols `group` icon next to contact name when matched; no icon for pending requests
- [x] 7.3 Add derived map / composable so icon updates reactively when friendships change
- [x] 7.4 Verify contacts store remains free of friendship state

## 8. Friend Requests Inbox Page

- [x] 8.1 Add route in `src/app/router/index.ts` (e.g., `/friends/requests`) gated by auth guard
- [x] 8.2 Create `FriendRequestsPage.vue` with two sections (incoming, outgoing) and accept/deny/cancel actions
- [x] 8.3 Render persistent deny-rights note at top of inbox (free to deny, no penalty, no extra leakage). Ensure Accept and Deny buttons are visually balanced (equal size + contrast)
- [x] 8.4 Empty-state copy when no pending requests in either direction
- [x] 8.5 Surface entry point (link in profile or side drawer) — minimal, can be a list item

## 8a. Phone Verification Security Notice

- [x] 8a.1 Add security-notice component to phone verification onboarding form: discoverability consequences, no-identity-leak guarantee, deny-right reservation, future revocation right
- [x] 8a.2 Add same notice to profile-edit phone verification flow
- [x] 8a.3 Gate "Send code" button behind explicit acknowledgement (checkbox or explicit "I understand" CTA)
- [x] 8a.4 Re-show + re-acknowledge notice when an already-verified user replaces their phone number
- [x] 8a.5 Source all notice copy from i18n (`friendships.verificationNotice.*`)

## 8b. vCard Single-File Constraint

- [x] 8b.1 Remove `multiple` attribute from vCard file input in import dialog
- [x] 8b.2 Update `useVCardImport` parse signature to accept exactly one `File`; throw validation error on zero or >1
- [x] 8b.3 Update existing vCard import tests to reflect single-file API; add failure-path test for multi-file rejection
- [x] 8b.4 Verify multi-block parsing within a single file still works end-to-end

## 9. i18n

- [x] 9.1 Add `friendships.*` keys to `en.json`: prompt title/body, prompt securityNote, learnMore, sendRequest, justSaveContact, requestSent, inboxEmpty, inboxDenyRightsNote, accept, deny, cancel, requestFrom, requestTo, verifyPhoneHint, verificationNotice.title, verificationNotice.body, verificationNotice.acknowledge
- [x] 9.2 Mirror all keys to `de-CH.json` with German translations
- [x] 9.3 Replace any hard-coded strings in new components with `t()` calls using global scope

## 10. Tests

- [x] 10.1 Unit tests for `useFriendshipsStore` actions (mock repository): unverified caller returns null/empty, sendRequest optimistic update, accept moves request to friendships, error paths
- [x] 10.2 Unit tests for connect-prompt suppression rules (caller unverified, self-match, already friend, pending request)
- [x] 10.3 Component test for contacts list row friendship icon (matched / unmatched / pending-only)
- [x] 10.4 Component test for import-results: batched discovery call exactly once over union of phones; matched rows render prompt; import succeeds even when request fails
- [x] 10.5 Component test for FriendRequestsPage: accept/deny/cancel call store actions, empty state renders, deny-rights note visible, Accept/Deny buttons balanced
- [x] 10.5a Component test for phone-verification security notice: send-code blocked until acknowledged, re-acknowledge required when phone replaced
- [x] 10.5b Test `useVCardImport` rejects multi-file input and parses multi-block single file
- [x] 10.6 Failure-path tests: RPC error, RLS rejection mapping, repeated send-request after acceptance

## 11. Finalize

- [x] 11.1 Run `npx eslint . --fix` until zero warnings
- [x] 11.2 Run `npm run format` and `npm run type-check`
- [x] 11.3 Run `npm run test` — all green
- [x] 11.4 Manual QA: verified user → import → match → accept on second account → friendship icon appears
- [x] 11.5 Prompt user to commit with conventional commit message: `feat(friendships): link contacts to platform accounts via verified phone (#21)`
- [x] 11.6 Prompt user to push branch and open PR referencing issue #21
- [x] 11.7 After merge, run `openspec archive` skill to archive this change
