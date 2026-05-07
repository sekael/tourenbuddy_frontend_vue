## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/111-rename-friendship-columns`

## 2. DB Migration

- [x] 2.1 Inspect local DB to find auto-generated check constraint name for `user_a_id < user_b_id` (`select conname from pg_constraint where conrelid = 'public.friendships'::regclass`)
- [x] 2.2 Create `supabase/migrations/<YYYYMMDD>_rename_friendship_columns.sql`
- [x] 2.3 Drop the `user_a_id < user_b_id` check constraint
- [x] 2.4 `alter table public.friendships rename column user_a_id to request_user_id`
- [x] 2.5 `alter table public.friendships rename column user_b_id to response_user_id`
- [x] 2.6 Backfill: for rows with non-null `request_id`, swap columns where `request_user_id <> friend_requests.from_user_id`
- [x] 2.7 Add functional unique index `friendships_unordered_pair_idx` on `(least(request_user_id, response_user_id), greatest(...))`
- [x] 2.8 Drop and recreate `friendships_select` RLS policy referencing new column names
- [x] 2.9 `create or replace function accept_friend_request` — insert as `(from_user_id, to_user_id)`, drop `least/greatest`
- [x] 2.10 `create or replace function remove_friendship` — delete where `(request_user_id = caller and response_user_id = other) or (request_user_id = other and response_user_id = caller)`
- [x] 2.11 `create or replace function find_phones_by_user_ids` — replace `user_a_id`/`user_b_id` refs in the friendships exists-clause
- [x] 2.12 Apply migration locally; verify rowcount unchanged; verify backfill correctness for a sample row

## 3. Code Updates

- [x] 3.1 Rename Zod fields in `src/features/friendships/data/models/friendship-schemas.ts`: `userAId` → `requestUserId`, `userBId` → `responseUserId`
- [x] 3.2 Update `Friendship` domain entity to match
- [x] 3.3 Update `mapFriendship` in `src/features/friendships/data/repositories/friendship-repository-impl.ts` to read `row.request_user_id` / `row.response_user_id`
- [x] 3.4 Grep + update all consumers of `userAId` / `userBId` (store, components, composables, tests) to `requestUserId` / `responseUserId`
- [x] 3.5 Confirm `npm run type-check` passes

## 4. Spec Update

- [x] 4.1 Update `openspec/specs/friendships/spec.md` per the change's `specs/friendships/spec.md` deltas (handled by archive step, but verify no drift)

## 5. Tests

- [x] 5.1 Update friendships repo unit tests for renamed fields
- [x] 5.2 Update friendships store unit tests
- [x] 5.3 `npm run test` — all green

## 6. Finalize

- [x] 6.1 `npx eslint . --fix` — zero warnings
- [x] 6.2 `npm run type-check` — clean
- [x] 6.3 Prompt user to commit with conventional commit message:
  - `refactor(friendships): rename friendship columns to request/response semantics (#111)`
- [x] 6.4 Prompt user to push branch and open PR linking issue #111
- [x] 6.5 After merge, prompt to archive change with `/opsx:archive`
