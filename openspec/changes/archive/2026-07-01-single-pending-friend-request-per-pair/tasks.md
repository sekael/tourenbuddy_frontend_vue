## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/209-single-pending-friend-request-per-pair`

## 2. Database migration

- [x] 2.1 Create migration: `supabase migration new single_pending_friend_request_per_pair`
- [x] 2.2 In the migration, dedupe existing dual-pending pairs: window-function CTE ranks pending rows per unordered pair (`row_number() over (partition by least/greatest order by created_at, id)`), cancel where `rn > 1`
- [x] 2.3 In the same migration, `DROP INDEX` the directional `friend_requests_pending_pair_idx` and `CREATE UNIQUE INDEX friend_requests_pending_pair_idx` on `(LEAST(from_user_id, to_user_id), GREATEST(from_user_id, to_user_id)) WHERE status = 'pending'`
- [x] 2.4 In the same migration, `CREATE OR REPLACE FUNCTION public.accept_friend_request(uuid)` adding an opposite-direction cancel (`from_user_id = v_to AND to_user_id = v_from AND status = 'pending' → cancelled, responded_at = now()`) after the friendship insert; preserve existing owner/grants/security-definer/search_path
- [x] 2.5 **(verifies your gap)** `supabase db reset` locally; seed opposing pending rows and verify dedupe leaves exactly one and a fresh reciprocal insert is rejected by the index

## 3. Store layer (`friendships-store.ts`)

- [x] 3.1 Add a lookup for the current user's pending **incoming** request from a given userId (`incomingRequestFrom(userId)` returns the `FriendRequest` or null), sourced from `incomingRequests`
- [x] 3.2 No code change needed — `sendRequest` already rolls back the optimistic row and rethrows (store L160-166), so the `23505` unique-violation surfaces cleanly to the caller. No `fetchAll`/resurface orchestration added.

## 4. Connect prompt accept variant (`connect-prompt.vue`)

- [x] 4.1 Derive the incoming request id from the store by `matchedUserId` (`acceptRequestId` computed via `store.incomingRequestFrom`); when non-null, render accept mode. (No prop threading — lazier than an `incomingRequestId` prop.)
- [x] 4.2 In accept mode, show an "Accept friend request" primary action (`friendships.accept`) that calls `store.accept(acceptRequestId)`; on success transition to the `accepted` state
- [x] 4.3 Add a generic "You are now friends" inline confirmation panel (name-less, mirrors the `state === 'sent'` block); emits `sent` so callers dismiss the prompt
- [x] 4.4 Keep send-mode behavior unchanged when no incoming request exists

## 5. Contact-flow gating (`contacts-list-sheet.vue`)

- [x] 5.1 No code change needed — `detailViewMatchedUserId` and `manualPromptUserId` only suppress **outgoing**-pending matches; incoming-pending matches already fall through and are surfaced. The bug was the prompt showing "Send", now fixed in §4.
- [x] 5.2 No wiring needed — the prompt derives the incoming request id itself from the store, so all three `ConnectPrompt` usages get the accept variant for free.

## 6. i18n

- [x] 6.1 Reused existing `friendships.accept` for the button; added `friendships.nowFriends` and `friendships.sendFailedRetry` (retry-prompting) to `en.json` AND `de-CH.json`; injected via `useI18n({ useScope: 'global' })`

## 7. Tests

- [x] 7.1 Store: `sendRequest` unique-violation path rolls back the optimistic row and rethrows (mock repository); `incomingRequestFrom` returns the pending incoming request for a matched userId and null when none
- [x] 7.2 Connect prompt: accept variant renders, calls `store.accept`, shows the now-friends confirmation on success; error path leaves an actionable state
- [x] 7.3 Run `npm run test` — all pass (1063)

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` (clean) and `npm run type-check` (clean); diff is tight (no editor reformat)
- [x] 8.2 Prompt the user to commit with a ready-to-copy conventional commit message (e.g. `feat(friendships): single pending request per user pair (#209)`) — do NOT run `git commit`
- [x] 8.3 Prompt the user to `supabase db push` (deploy step — only after review) and to push the branch + open a PR to `main`
- [x] 8.4 After merge, prompt the user to archive this change with `openspec-archive`
