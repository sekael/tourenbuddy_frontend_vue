## Why

`friendships.user_a_id` / `user_b_id` carry no semantic meaning — they are just canonically ordered (`a < b`). Readers of the schema cannot tell who initiated the friendship vs. who accepted it. Renaming to `request_user_id` / `response_user_id` (issue #111) makes the data model self-describing and matches `friend_requests.from_user_id` / `to_user_id` semantics.

## What Changes

- **BREAKING (DB schema):** Rename `friendships.user_a_id` → `request_user_id`, `friendships.user_b_id` → `response_user_id`.
- **BREAKING (invariant):** Drop the `user_a_id < user_b_id` canonical-ordering check. Rows now order by request semantics: `request_user_id` = sender of accepted request, `response_user_id` = accepter. Primary key becomes `(request_user_id, response_user_id)`.
- Update RPCs that read/write the table:
  - `accept_friend_request` — insert as `(from_user_id, to_user_id)` instead of `(least, greatest)`.
  - `remove_friendship` — delete by either ordering of caller/other (since pair no longer canonical).
  - `find_phones_by_user_ids` — reference new column names.
- Update repository (`friendship-repository-impl.ts`) row mapping + Zod schema field names.
- Update spec `openspec/specs/friendships/spec.md` to reflect new column names and dropped canonical-order invariant.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `friendships`: rename friendship row columns; drop canonical-order invariant; adjust accept/remove RPCs and read paths.

## Impact

- Migration: new SQL migration renames columns, drops `user_a_id < user_b_id` check, recreates RPCs (`accept_friend_request`, `remove_friendship`, `find_phones_by_user_ids`), updates RLS policy column refs.
- Code: `src/features/friendships/data/repositories/friendship-repository-impl.ts`, `src/features/friendships/data/models/friendship-schemas.ts` (field rename), any store/component reading `userAId`/`userBId`.
- Tests: friendships repo + store tests.
- No client API surface change beyond repository internals; store/composable interface unchanged.
- Existing rows: rename is data-preserving; column values stay intact, just under new names. Canonical-ordering check removal is non-destructive.
