## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/174-block-users`

## 2. Database Migration

- [x] 2.1 Create migration file via `supabase migration new add_user_blocks_and_reporting`
- [x] 2.2 Create `public.user_blocks` table: composite PK `(blocker_user_id, blocked_user_id)`, FK CASCADE on both, `first_blocked_at` NOT NULL default `now()`, `last_blocked_at` NOT NULL default `now()`, nullable `unblocked_at`, CHECK `blocker_user_id <> blocked_user_id`
- [x] 2.3 Enable RLS on `user_blocks`; add SELECT policy `auth.uid() = blocker_user_id`. Do NOT grant direct INSERT/UPDATE/DELETE — writes only via RPCs
- [x] 2.4 Create `public.abuse_reports` table: `id bigint identity PK`, `reporter_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL`, `reported_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL`, `reason text CHECK (length(reason) <= 1000)`, `created_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (reporter_user_id, reported_user_id)`. Enable RLS; INSERT policy `auth.uid() = reporter_user_id`; no SELECT for `authenticated`
- [x] 2.5 Create SECURITY DEFINER function `public.is_blocked_by(target uuid) returns boolean`; REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated
- [x] 2.6 Create SECURITY INVOKER function `public.block_user(target uuid)` performing atomic cascade: validate target ≠ caller, require `is_phone_verified(auth.uid())` (raise otherwise), acquire `pg_advisory_xact_lock(hashtext('block:' || least(...) || ':' || greatest(...)))` keyed on the symmetric pair, raise `already_blocked` if active row exists, call existing helper `terminate_pending_and_friendship_between(auth.uid(), array[target])` to drop friendship + terminate pending requests, INSERT ... ON CONFLICT DO UPDATE setting `unblocked_at = NULL`, `last_blocked_at = now()` (preserving `first_blocked_at`). NO re-block cooldown
- [x] 2.7 Create SECURITY INVOKER function `public.unblock_user(target uuid)` enforcing 48h cooldown since `last_blocked_at`; sets `unblocked_at = now()` (retains row). Raise `cooldown_active` with remaining seconds in DETAIL on violation
- [x] 2.8 Create SECURITY INVOKER function `public.report_user(target uuid, reason text)`: `INSERT INTO abuse_reports (reporter_user_id, reported_user_id, reason) VALUES (auth.uid(), target, reason) ON CONFLICT (reporter_user_id, reported_user_id) DO UPDATE SET reason = EXCLUDED.reason, created_at = now()`
- [x] 2.9 Create SECURITY INVOKER function `public.send_friend_request(p_to_user_id uuid) returns public.friend_requests`: acquire `pg_advisory_xact_lock` keyed on the symmetric pair (same key formula as `block_user`), then raise `blocked_by_target` (`ERRCODE = 'P0001'`) if active `user_blocks(to_user_id, auth.uid())` exists, otherwise INSERT and return the row
- [x] 2.10 `DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests`; then CREATE replacement with original predicates (`auth.uid() = from_user_id AND is_phone_verified(auth.uid()) AND is_phone_verified(to_user_id)`) AND new `NOT EXISTS user_blocks(blocker_user_id = to_user_id, blocked_user_id = from_user_id, unblocked_at IS NULL)` predicate (defense in depth alongside the RPC)
- [x] 2.10 CREATE OR REPLACE function bodies for `find_users_by_phones`, `find_phones_by_user_ids`, `get_user_names_by_ids` — keep argument signatures unchanged, add bidirectional block filter (active row in either direction excludes the candidate). Do NOT modify `find_user_by_phone` or `is_phone_registered` — both are exempt as pre-check RPCs
- [x] 2.11 `ALTER TABLE public.user_blocks REPLICA IDENTITY FULL`; add to `supabase_realtime` publication via `DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` (mirrors existing pattern in `20260520101408_realtime_friendships_publication.sql`)
- [x] 2.12 Run `supabase db reset`; verify schema, policies, and each RPC behaviour via SQL queries

## 3. Domain & Data Layers

- [x] 3.1 Add `src/features/friendships/data/models/user-block-schemas.ts` (Zod schema including nullable `unblockedAt`)
- [x] 3.2 Add `src/features/friendships/data/models/abuse-report-schemas.ts`
- [x] 3.3 Add domain entity re-exports `domain/entities/user-block.ts`, `domain/entities/abuse-report.ts`
- [x] 3.4 Add `domain/repositories/user-block-repository.ts` interface: `listActive()`, `block(targetUserId)`, `unblock(targetUserId)`, `isBlockedBy(targetUserId)`, `report(targetUserId, reason)`
- [x] 3.5 Add custom exceptions in `core/exceptions/`: `BlockCooldownError(remainingSeconds)`, `BlockAlreadyExistsError`, `NotBlockedError`, `BlockedBySenderError`
- [x] 3.6 Add `data/repositories/user-block-repository-impl.ts` calling Supabase RPCs and mapping Postgres error codes/messages to typed exceptions
- [x] 3.7 Update `FriendshipRepositoryImpl.sendRequest` to call new `send_friend_request` RPC instead of direct INSERT; map `blocked_by_target` to `BlockedBySenderError`

## 4. Store & Realtime

- [x] 4.1 Create `src/features/friendships/presentation/stores/user-blocks-store.ts` (composition store)
- [x] 4.2 State: `blocks` (active rows), `loading`, `error`, `isBlockedByCache: Map<userId, { value: boolean, ts: number }>` with 5-minute TTL
- [x] 4.3 Actions: `fetchBlocks`, `block(userId)`, `unblock(userId)`, `isBlockedBy(userId)` (memoized w/ TTL), `report(userId, reason)`. Treat `BlockAlreadyExistsError` from `block` and `NotBlockedError` from `unblock` as silent success (end-state matches intent — e.g. another device performed the same action)
- [x] 4.4 Wire Supabase Realtime `postgres_changes` on `user_blocks` filtered to `blocker_user_id = auth.uid()`; handle INSERT, UPDATE (re-block flips unblocked_at), DELETE
- [x] 4.5 Invalidate `isBlockedByCache` on auth change AND on `document.visibilitychange` → visible
- [x] 4.6 Hook into existing friendships store realtime handlers: on `friendships` DELETE for target X, invalidate `isBlockedByCache[X]`; on `friend_requests` UPDATE for target X reaching terminal status without local user action, invalidate `isBlockedByCache[X]`
- [x] 4.7 In `friendships-store` send-request action, map server block-rejection error to: set `isBlockedByCache[target] = true`, surface generic snackbar (do not reveal block reason)

## 5. UI: Blocked Tab + Cooldown Notices

- [x] 5.1 In `friend-requests-sheet.vue`, add tab switcher between "Pending" and "Blocked"
- [x] 5.2 Implement `presentation/components/blocked-list.vue`: list active blocks (filter `unblockedAt === null`), show display name + avatar + blocked-since
- [x] 5.3 Per-row Unblock button: disabled when `now() - createdAt < 48h`, label includes remaining hours via i18n with `{hours}` interpolation
- [x] 5.4 Empty state via i18n key
- [x] 5.5 Wire Unblock click to store action; on `BlockCooldownError`, surface inline notice with returned remaining hours (defensive — should be prevented by disabled state)

## 6. UI: Block Action Surfaces + Confirm Dialog

- [x] 6.1 Implement `presentation/components/block-confirm-dialog.vue` — title, body warning that friendship will be removed (conditional copy when no friendship), persistent 48h-unblock-cooldown notice (shown on every block confirmation), optional "Also report this user" toggle + reason text input, Cancel + Confirm buttons
- [x] 6.2 Add Block button to each pending incoming request row in `friend-requests-sheet.vue`; opens confirm dialog (no unfriend warning since no friendship)
- [x] 6.3 Add Block action to friend / contact detail view; render only when contact has resolved to a registered user (`target_user_id` available); existing-friend path opens confirm dialog with unfriend warning copy, registered-but-not-friend path opens confirm dialog without unfriend warning
- [x] 6.4 Confirm handler: call `user-blocks-store.block(targetUserId)`; if "Also report" enabled, additionally call `store.report(targetUserId, reason)` after successful block; surface combined snackbar on success / generic error on failure

## 7. UI: Hide Send Affordance When Blocked

- [x] 7.1 Grep for every "send friend request" affordance (start with `connect-prompt.vue`, friendships store usages); enumerate in PR description
- [x] 7.2 For each affordance, call `user-blocks-store.isBlockedBy(targetUserId)` and conditionally render

## 8. Internationalization

- [x] 8.1 Add new keys to `src/features/i18n/locales/en.json`: block action, unblock action, blocked tab label, empty state, confirm dialog (with + without friendship variants), persistent unblock-cooldown disclosure ("You will only be able to unblock this user after 48 hours"), report toggle, report reason placeholder, remaining-time notice with `{hours}`, snackbars (block success, unblock success, report success, cooldown error)
- [x] 8.2 Mirror keys with German Du-form translations in `src/features/i18n/locales/de-CH.json`
- [x] 8.3 Verify no other locale files exist; if more present, add keys to all

## 9. Tests

- [x] 9.1 Repo unit tests: each RPC error code maps to correct typed exception
- [x] 9.2 Store unit tests: block / unblock happy paths, cooldown error surfaces, isBlockedBy cache hit / miss / TTL expiry, visibilitychange invalidation, realtime INSERT / UPDATE / DELETE handlers
- [x] 9.3 Component test for `blocked-list.vue`: empty state, active rows rendered, Unblock disabled within cooldown showing hours, Unblock enabled after cooldown calls store
- [x] 9.4 Component test for `block-confirm-dialog.vue`: with-friendship vs without-friendship copy, report toggle, confirm calls store actions in correct order
- [x] 9.5 Component test for Block buttons on pending-request rows and friend detail trigger dialog with correct props
- [x] 9.6 Discovery filter integration test (against local Supabase):

  **Setup** — open `supabase/studio` or run via psql (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Create two test users A and B (use `supabase/seed.sql` patterns or insert directly into `auth.users`). Register phone numbers for both via `public.users` table. Insert an active block: `INSERT INTO public.user_blocks (blocker_user_id, blocked_user_id) VALUES ('<A>', '<B>');`

  **find_users_by_phones** — call as user A, pass B's phone number:
  ```sql
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<A-uuid>"}';
  SELECT * FROM public.find_users_by_phones(ARRAY['<B-phone>']);
  -- expect: 0 rows (B blocked by A, bidirectional)
  ```
  Repeat call as user B passing A's phone — also 0 rows (A blocked B).

  **find_phones_by_user_ids** — call as user A, pass `ARRAY['<B-uuid>']`:
  ```sql
  SELECT * FROM public.find_phones_by_user_ids(ARRAY['<B-uuid>'::uuid]);
  -- expect: 0 rows
  ```

  **get_user_names_by_ids** — call as user A, pass `ARRAY['<B-uuid>']`:
  ```sql
  SELECT * FROM public.get_user_names_by_ids(ARRAY['<B-uuid>'::uuid]);
  -- expect: 0 rows
  ```

  **Exempt RPCs (must still return data)**:
  ```sql
  SELECT * FROM public.find_user_by_phone('<B-phone>');
  -- expect: row returned (no block filter)
  SELECT public.is_phone_registered('<B-phone>');
  -- expect: true
  ```

  **Self-match unaffected** — call `find_users_by_phones` as user A passing A's own phone:
  ```sql
  SELECT * FROM public.find_users_by_phones(ARRAY['<A-phone>']);
  -- expect: 1 row (self never blocked)
  ```

  **Cleanup**: `DELETE FROM public.user_blocks WHERE blocker_user_id = '<A>';`

- [x] 9.7 Cascade integration test: block from existing-friendship state.

  **Setup** — ensure users A and B have an active friendship row in `public.friendships`. Also insert a pending friend request from A to B in `public.friend_requests` (status = 'pending').

  **Block action** — call `block_user` as user A targeting B:
  ```sql
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<A-uuid>"}';
  SELECT public.block_user('<B-uuid>'::uuid);
  ```

  **Verify cascade**:
  ```sql
  -- friendship removed
  SELECT * FROM public.friendships
  WHERE (request_user_id = '<A>' AND response_user_id = '<B>')
     OR (request_user_id = '<B>' AND response_user_id = '<A>');
  -- expect: 0 rows

  -- pending requests terminated (both directions)
  SELECT * FROM public.friend_requests
  WHERE (from_user_id = '<A>' AND to_user_id = '<B>')
     OR (from_user_id = '<B>' AND to_user_id = '<A>');
  -- expect: 0 rows (or status = 'declined', depending on terminate helper behavior)

  -- block row inserted
  SELECT * FROM public.user_blocks
  WHERE blocker_user_id = '<A>' AND blocked_user_id = '<B>'
    AND unblocked_at IS NULL;
  -- expect: 1 row
  ```

  **All-or-nothing** — to verify atomicity, wrap a block call in a transaction and ROLLBACK, then check none of the above side-effects persisted:
  ```sql
  BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<A-uuid>"}';
  SELECT public.block_user('<B-uuid>'::uuid);
  ROLLBACK;
  -- all three queries above should now return original state
  ```

- [ ] 9.7b Concurrency test: advisory lock serializes `block_user` + `send_friend_request`.

  **Setup** — users A and B, no block, no friendship, no pending request.

  Open **two psql sessions** (two terminal tabs). In session 1:
  ```sql
  BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<A-uuid>"}';
  SELECT public.block_user('<B-uuid>'::uuid);
  -- DO NOT COMMIT YET — leave transaction open
  ```

  Immediately in session 2 (before session 1 commits):
  ```sql
  BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<B-uuid>"}';
  SELECT public.send_friend_request('<A-uuid>'::uuid);
  -- expect: blocks waiting on advisory lock until session 1 commits
  ```

  Commit session 1: `COMMIT;`

  Session 2 should now unblock and raise `blocked_by_target` (SQLSTATE P0001), not succeed.

  **Verify end-state**:
  ```sql
  -- no pending request row alongside active block
  SELECT * FROM public.friend_requests
  WHERE from_user_id = '<B>' AND to_user_id = '<A>' AND status = 'pending';
  -- expect: 0 rows

  SELECT * FROM public.user_blocks
  WHERE blocker_user_id = '<A>' AND blocked_user_id = '<B>' AND unblocked_at IS NULL;
  -- expect: 1 row
  ```

- [x] 9.8 Cooldown integration test.

  **Setup** — users A and B, no prior block.

  **Block**:
  ```sql
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<A-uuid>"}';
  SELECT public.block_user('<B-uuid>'::uuid);
  -- expect: success
  ```

  **Unblock within 48h — must fail**:
  ```sql
  SELECT public.unblock_user('<B-uuid>'::uuid);
  -- expect: raises cooldown_active with remaining seconds in DETAIL
  ```

  **Advance time past 48h** — update `last_blocked_at` directly (local DB only):
  ```sql
  UPDATE public.user_blocks
  SET last_blocked_at = now() - interval '49 hours'
  WHERE blocker_user_id = '<A>' AND blocked_user_id = '<B>';
  ```

  **Unblock now — must succeed**:
  ```sql
  SELECT public.unblock_user('<B-uuid>'::uuid);
  -- expect: success, unblocked_at IS NOT NULL
  SELECT unblocked_at FROM public.user_blocks
  WHERE blocker_user_id = '<A>' AND blocked_user_id = '<B>';
  -- expect: recent timestamp
  ```

  **Immediate re-block — must succeed (no re-block cooldown)**:
  ```sql
  SELECT public.block_user('<B-uuid>'::uuid);
  -- expect: success (upsert flips unblocked_at back to NULL, updates last_blocked_at)
  SELECT unblocked_at, last_blocked_at FROM public.user_blocks
  WHERE blocker_user_id = '<A>' AND blocked_user_id = '<B>';
  -- expect: unblocked_at IS NULL, last_blocked_at ≈ now()
  ```

  **Cleanup**: `DELETE FROM public.user_blocks WHERE blocker_user_id = '<A>';`
- [x] 9.9 Run `npm run test` — all pass

## 10. Finalize

- [x] 10.1 Run `npx eslint . --fix` (zero warnings)
- [x] 10.2 Run `npm run type-check` (zero errors)
- [x] 10.3 Manual smoke locally: full social cut verified (friend req rejected, discovery RPCs return no rows for blocker, existing friendship removed on block, unblock + re-block cooldown shows correct hours)
- [x] 10.4 Prompt user to commit with ready-to-copy conventional commit message: `feat(friendships): user blocking with full social cut, cooldown, and reporting (#174)`
- [x] 10.5 Prompt user to push branch and open PR; remind user to run `supabase db push` as a separate deploy step after merge
