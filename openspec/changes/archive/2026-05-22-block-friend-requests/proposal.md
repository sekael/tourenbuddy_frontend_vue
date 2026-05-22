## Why

Users have no way to stop another user from re-sending friend requests or interacting with them after a decline. Beyond friend requests, the wider interaction surface (phone-based discovery, name lookup, friendship state) provides no block-aware gating either. Issue #174 asks for a persistent, cross-device block — and best-practice block semantics extend across every server-mediated user-to-user surface, not just friend requests.

## What Changes

- New persistent block model: `user_blocks(blocker_user_id, blocked_user_id, created_at, unblocked_at, last_unblock_at)` covering the full block lifecycle including cooldown tracking.
- Block enforcement at every server-mediated user-to-user surface (full social cut), not just friend requests:
  - `friend_requests` INSERT blocked when blocker exists.
  - Discovery RPCs (`find_user_by_phone`, `find_users_by_phones`, `find_phones_by_user_ids`, `is_phone_registered`, `get_user_names_by_ids`) filter out rows where the caller is blocked by the target.
  - Existing `friendships` rows between the two users are deleted on block (cascade unfriend).
  - Pending `friend_requests` (both directions) are terminated on block (cancelled or denied per direction).
- Block entry points:
  - Block button on incoming pending friend request in `friend-requests-sheet.vue`.
  - Block button on existing friend (contact / friend detail) — confirmation dialog warns about unfriend.
  - Unblock action in new "Blocked" tab of friend requests sheet.
- Single atomic block RPC `block_user(target_user_id)` performs in one transaction: terminate pending requests, delete friendship row(s), insert block row.
- **Unblock cooldown: 48 hours.** After unblocking, the same user cannot be re-blocked for 48 hours. After re-blocking, the user cannot be unblocked for 48 hours (prevents toggle abuse). UI shows explicit notice with remaining time before either action becomes available again.
- Sender-side affordance hide via SECURITY DEFINER `is_blocked_by(target)` RPC — only a boolean, no enumeration.
- New `abuse_reports(reporter_user_id, reported_user_id, reason, created_at)` table with INSERT-only RLS — captures reports as a record; **no moderation pipeline, no admin tooling, no automated action.** Block UI offers an optional "Also report" checkbox / paired action.
- Realtime sync of own blocklist via `postgres_changes` on `user_blocks`.
- i18n: keys for block, unblock, cooldown notice (with `{hours}` interpolation), unfriend warning dialog, blocked tab, empty state, report action, snackbars — added to `en` and `de-CH`.

## Capabilities

### New Capabilities
- `user-blocks`: persistent, cross-device block list. Enforces full social cut across friend requests, discovery, name lookup, and friendship state. Includes unblock cooldown and abuse-report capture.

### Modified Capabilities
- `friendships`: friend-request send path consults block state server-side; block action terminates pending requests and existing friendships atomically; friendship cleanup ordering must preserve blocks (blocks outlive friendships).
- `phone-formatting` / `contact-account-linking`: discovery RPC results filtered by block state — blocked-by users no longer appear in phone-to-user resolution.

## Impact

- DB: new migration adds `user_blocks` (with cooldown columns), `abuse_reports`, RLS policies, `is_blocked_by` RPC, `block_user` RPC, `unblock_user` RPC (enforces cooldown), `report_user` RPC; rewrites discovery RPCs (`find_user_by_phone`, `find_users_by_phones`, `find_phones_by_user_ids`, `is_phone_registered`, `get_user_names_by_ids`) to filter blocked-by rows; updates `friend_requests` INSERT RLS to reject blocked senders; adds realtime publication entry for `user_blocks`.
- Code: new files under `src/features/friendships/` for blocks (schemas, repo, store, components); modifications to `friend-requests-sheet.vue`, `connect-prompt.vue`, friend/contact detail view (block entry from existing friend), any place that calls discovery RPCs (results already filtered server-side, but UI should be reviewed).
- i18n: new keys in `en.json`, `de-CH.json`.
- Tests: store + RPC unit tests, component tests for sheet tab and block-from-friend confirmation, cooldown enforcement test, discovery-filter test.
