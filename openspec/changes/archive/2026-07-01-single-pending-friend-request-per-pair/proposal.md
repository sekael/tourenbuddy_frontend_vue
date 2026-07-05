## Why

Friend requests are modeled as directional rows, and the only uniqueness guard is a partial index on `(from_user_id, to_user_id) WHERE status = 'pending'`. Because `A→B` and `B→A` are different ordered pairs, both can sit `pending` at once. This happens in practice (issue #209): A sends A→B; B later adds A as a contact, the connect prompt offers "Send request", and B sends B→A. Now two opposing pending rows exist, and accepting one leaves the other dangling as a phantom incoming/outgoing request. The relationship between two users should be a single logical thing, so there must be at most **one** open request per unordered pair `{A, B}`, and any "send toward someone who already asked me" action must resolve the existing request rather than duplicate it.

## What Changes

- Enforce **at most one pending `friend_request` per unordered pair** via an unordered partial unique index on `(least(from,to), greatest(from,to)) WHERE status = 'pending'`, replacing the directional one. A migration first dedupes any existing dual-pending pairs (keep the oldest, cancel the rest) so the new index can be created.
- `accept_friend_request` additionally **cancels any opposite-direction pending row** for the same pair in the same transaction — defensive cleanup for legacy dual-pending data and belt-and-suspenders once the index is in place.
- The connect prompt gains an **accept path**: when the matched target already has a **pending incoming** request to the current user (detected purely from store state), the prompt shows "Accept friend request" (calling `store.accept(incomingId)`) instead of "Send request", then swaps to an inline generic **"You are now friends"** confirmation panel — reusing the existing `sent`-state pattern.
- The contact-flow gating computeds surface incoming-pending matches (instead of only excluding outgoing-pending), so the accept affordance appears where the duplicate-send used to.
- The friend-request-**responded** notification fires to the original requester on this accept, exactly as explicit accept does today (no new dispatch types).
- The rare **concurrent cross-send** (both users hit Send before either's Realtime echo arrives) is left to the index: the second insert is rejected, and the sender gets a **retry-prompting** failure message. No auto-recovery code is written — a reopen shows "Accept" once Realtime delivers the incoming request.

## Capabilities

### New Capabilities

_None._ Behavior lives in the existing `friendships` capability.

### Modified Capabilities

- `friendships`: the pending-request uniqueness constraint changes from directional to **unordered pair** (single open request per `{A,B}`); `accept_friend_request` gains opposite-direction pending cleanup; a new requirement mandates that a send affordance toward a user who already has a pending request to the caller **resolves it by accepting** (with an explicit "now friends" disclaimer and the responded notification) rather than creating a second pending row.

## Impact

- **DB (one new migration):** replace `friend_requests_pending_pair_idx` with an unordered partial unique index; dedupe pre-existing dual-pending rows; update `accept_friend_request` to cancel the opposite-direction pending row. Must be applied to local Supabase first (`supabase db reset`), pushed to prod only after review.
- **Frontend:**
  - `src/features/friendships/presentation/stores/friendships-store.ts` — expose incoming-request lookup by userId; surface a retry-prompting error on the rare send unique-violation (no refetch/resurface orchestration).
  - `src/features/friendships/presentation/components/connect-prompt.vue` — accept variant + "now friends" confirmation panel.
  - `src/features/contacts/presentation/components/contacts-list-sheet.vue` — gating computeds (`detailViewMatchedUserId`, `manualPromptUserId`) surface incoming-pending matches; pass the incoming request id to the prompt.
- **i18n:** new keys in `en.json` and `de-CH.json` (accept-request label, "you are now friends" disclaimer).
- **No Worker changes, no new deps, no new env vars.** Notification dispatch reuses the existing `notifyFriendRequestResponded`.
- **Interplay with existing cleanup logic:** the "Re-establishing the link allows new friend requests" requirement (terminal-status rows must not collide with the pending index) still holds — the new index is also `WHERE status = 'pending'`, so terminal rows never collide.
