## Context

Issue #174 asks for blocking friend requests. Modern block semantics span well beyond friend requests: discovery, name lookup, existing-relationship teardown, and toggle-abuse prevention. This design implements a full social cut in one change — every server-mediated user-to-user surface in the current schema becomes block-aware. Abuse reporting is captured but intentionally has no moderation pipeline (no admin tool, no automated action) — the contract exists for future moderation work.

Surfaces enumerated in current schema:
- `friend_requests` INSERT
- `friendships` (existing relationship)
- Discovery RPCs: `find_user_by_phone`, `find_users_by_phones`, `find_phones_by_user_ids`, `is_phone_registered`, `get_user_names_by_ids`
- (`tour_partners` and `tour-group-messaging` are local / client-side SMS — not server-mediated user-to-user, so not gated here.)

## Goals / Non-Goals

**Goals:**
- Full social cut on block: blocker invisible to blocked across friend requests + discovery + name lookup; existing friendship removed; pending requests terminated.
- Atomic `block_user` RPC: cascade as single transaction.
- Unblock cooldown 48 h, enforced server-side, surfaced in UI with remaining-hours notice.
- Block entry from pending request, existing friend, and contact detail.
- Abuse report capture (insert-only, no pipeline).
- Realtime sync of own blocklist.
- DDD layering mirrors existing friendships feature.

**Non-Goals:**
- Moderation pipeline / admin tooling / automated action on reports.
- Hiding blocker from blocked user's local data (contacts, tour partners) — these are the blocker's local records, not the blocked user's surfaces; only the blocked user's *server-mediated discovery* of the blocker is filtered.
- Blocking from arbitrary surfaces (e.g., search bar) — entry points are the three named above.
- Anti-circumvention for new-account creation — phone-based identity is the existing weak mitigation.

## Decisions

### Decision: `public.user_blocks` schema with cooldown columns on the row itself

```
blocker_user_id   uuid  NOT NULL  REFERENCES auth.users(id) ON DELETE CASCADE
blocked_user_id   uuid  NOT NULL  REFERENCES auth.users(id) ON DELETE CASCADE
first_blocked_at  timestamptz NOT NULL DEFAULT now()
last_blocked_at   timestamptz NOT NULL DEFAULT now()
unblocked_at      timestamptz NULL
PRIMARY KEY (blocker_user_id, blocked_user_id)
CHECK (blocker_user_id <> blocked_user_id)
```

`unblocked_at IS NULL` ⇒ block active. `unblocked_at IS NOT NULL` ⇒ inactive, kept solely for cooldown calculation. Re-block UPDATEs the existing row (locked behavior, no fresh row): `unblocked_at = NULL`, `last_blocked_at = now()`, `first_blocked_at` unchanged. PK stable — realtime emits UPDATE event, never DELETE+INSERT.

Cooldown clock (only one direction):
- Unblock cooldown gate: `now() - last_blocked_at >= interval '48 hours'`.
- Re-block: no cooldown — `block_user` succeeds immediately regardless of prior unblock timing.

`first_blocked_at` is informational (audit / display) and never read by enforcement.

**Alternative considered:** delete on unblock + separate `block_cooldowns` table. Rejected — two tables for one relationship doubles RLS surface for no win; retained-row model is simpler.

### Decision: RLS on `user_blocks`

- SELECT: `auth.uid() = blocker_user_id` (blocker sees only own rows; blocked users never see they were blocked).
- INSERT / UPDATE / DELETE: not granted directly — all writes go through SECURITY DEFINER RPCs (`block_user`, `unblock_user`) which centralize cooldown enforcement and cascade logic. DEFINER is required because no INSERT/UPDATE/DELETE policies exist on `user_blocks` (intentionally — writes are RPC-only), so an INVOKER-mode RPC's own writes would be RLS-rejected. Authorization is preserved inside each RPC body via `auth.uid()` checks: the inserted row uses `blocker_user_id = auth.uid()` and lookups are qualified by the caller. The same reasoning applies to `report_user` writing `abuse_reports`. This avoids any path where a client can bypass cooldown by direct DML.

**Alternative considered:** allow direct INSERT/UPDATE with policy-level cooldown predicate. Rejected — cooldown logic in RLS predicates is harder to read and harder to surface remaining time to the client. RPC bodies are clearer.

### Decision: `block_user(target uuid)` RPC — single atomic cascade (SECURITY DEFINER)

PL/pgSQL body (sketch):

```sql
-- 1. validate target <> auth.uid()
-- 2. require is_phone_verified(auth.uid()) — raise otherwise
-- 3. acquire pair-scoped advisory lock to serialize against concurrent send_friend_request:
--      perform pg_advisory_xact_lock(
--        hashtext('block:' || least(auth.uid()::text, target::text)
--                          || ':' || greatest(auth.uid()::text, target::text))
--      );
-- 4. if active row (A, target) exists → raise 'already_blocked'
--    (no re-block cooldown — proceed even if inactive row is recent)
-- 5. perform cascade by REUSING existing helper (single source of truth):
--      perform public.terminate_pending_and_friendship_between(auth.uid(), array[target]);
--    The helper deletes any friendship row in either column order, cancels outgoing
--    pending requests, and denies incoming pending requests.
-- 6. INSERT user_blocks(auth.uid(), target) ON CONFLICT (blocker_user_id, blocked_user_id) DO UPDATE
--     SET unblocked_at = NULL, last_blocked_at = now();
--     first_blocked_at preserved by NOT updating it
```

Wrapped in a single transaction (PL/pgSQL function bodies are implicitly transactional with their caller). The helper is SECURITY DEFINER but accepts the actor as a parameter — `block_user` always passes `auth.uid()`, so no privilege escalation. `block_user` itself is SECURITY DEFINER (see RLS decision above) and consistently authorizes via `auth.uid()` checks inside the body.

Errors raised as `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cooldown_active', DETAIL = '<seconds>'` so the client can parse and localize.

### Decision: `unblock_user(target uuid)` RPC — SECURITY DEFINER

Body:
1. Fetch active row `(auth.uid(), target)` — raise if none.
2. If `now() - last_blocked_at < 48 hours` → raise `'cooldown_active'` with remaining seconds.
3. `UPDATE user_blocks SET unblocked_at = now() WHERE blocker_user_id = auth.uid() AND blocked_user_id = target`.

Inactive row retained — required for cooldown of re-block.

### Decision: `is_blocked_by(target uuid) returns boolean` (SECURITY DEFINER)

Body: `EXISTS (SELECT 1 FROM user_blocks WHERE blocker_user_id = target AND blocked_user_id = auth.uid() AND unblocked_at IS NULL)`.

`REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated;`. Returns only the boolean about the specific pair — no enumeration possible.

### Decision: Discovery RPCs gain a blocked-by filter

Rewrite (via NEW migration) the function bodies of `find_users_by_phones`, `find_phones_by_user_ids`, and `get_user_names_by_ids` to add a **bidirectional** block-filter predicate. The self-conflict pre-check RPCs `find_user_by_phone` and `is_phone_registered` are EXEMPT (see Visibility note below):

```
NOT EXISTS (
  SELECT 1 FROM user_blocks
  WHERE unblocked_at IS NULL
    AND (
      (blocker_user_id = <candidate>.id AND blocked_user_id = auth.uid())
      OR
      (blocker_user_id = auth.uid()     AND blocked_user_id = <candidate>.id)
    )
)
```

**Pre-check exemption rationale:** `is_phone_registered` returns only a boolean and leaks no identity. `find_user_by_phone` returns a uid but it is inert under the other enforcement (friend-request INSERT, bulk discovery, name lookup, `is_blocked_by`). Without the bypass, the auth layer's own collision check would still reject OTP send — so filtering only delays the same failure with worse UX. The bypass is narrow: it covers exactly these two RPCs, and only because they exist as pre-checks for an auth-layer guarantee.

`find_user_by_phone` already filters by self-vs-other in some call paths (phone-verification pre-check uses it on caller's own number). The block filter applies only to non-self matches, which is consistent because `blocker_user_id <> blocked_user_id` makes self-block impossible.

### Decision: New `send_friend_request(target uuid)` RPC + RLS predicate (defense in depth)

The existing client path does a direct INSERT on `friend_requests`. To allow the client to reliably distinguish a block rejection from other RLS denials, add a SECURITY INVOKER RPC:

```sql
create or replace function public.send_friend_request(p_to_user_id uuid)
returns public.friend_requests
language plpgsql
security invoker
as $$
declare v_row public.friend_requests;
begin
  -- Pair-scoped advisory lock — serializes against concurrent block_user(p_to_user_id)
  perform pg_advisory_xact_lock(
    hashtext('block:' || least(auth.uid()::text, p_to_user_id::text)
                      || ':' || greatest(auth.uid()::text, p_to_user_id::text))
  );

  if exists (
    select 1 from public.user_blocks
    where blocker_user_id = p_to_user_id
      and blocked_user_id = auth.uid()
      and unblocked_at is null
  ) then
    raise exception 'blocked_by_target' using errcode = 'P0001';
  end if;

  insert into public.friend_requests (to_user_id)
  values (p_to_user_id)
  returning * into v_row;

  return v_row;
end $$;
```

The advisory lock is `pg_advisory_xact_lock` (transaction-scoped, auto-released on COMMIT/ROLLBACK). Lock key is symmetric in the pair so `block_user(A→B)` and `send_friend_request(B→A)` contend on the same key. Same lock key used in `block_user` and `send_friend_request`; lock contention is minimal because keyed per-pair.

`FriendshipRepositoryImpl.sendRequest` is updated to call this RPC and map `blocked_by_target` to a typed `BlockedBySenderError`. The store's send action catches that error and runs the rejection-driven cache invalidation step.

The friend_requests INSERT RLS predicate **also** carries the block check (next decision) so any direct INSERT path (custom client, future code) is still hard-rejected by Postgres.

### Decision: `friend_requests` INSERT RLS extended

Existing policy is named `friend_requests_insert` (confirmed in `20260101000000_initial_schema.sql`) with predicates `auth.uid() = from_user_id AND is_phone_verified(auth.uid()) AND is_phone_verified(to_user_id)`. Migration uses `DROP POLICY IF EXISTS "friend_requests_insert"` then CREATEs with the original three predicates plus the new block predicate:

```
NOT EXISTS (
  SELECT 1 FROM public.user_blocks
  WHERE blocker_user_id = NEW.to_user_id
    AND blocked_user_id = NEW.from_user_id
    AND unblocked_at IS NULL
)
```

Combined with existing `auth.uid() = from_user_id` predicate.

### Decision: `abuse_reports` table — capture only

```
id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY
reporter_user_id  uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
reported_user_id  uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
reason            text CHECK (reason IS NULL OR length(reason) <= 1000)
created_at        timestamptz NOT NULL DEFAULT now()
UNIQUE (reporter_user_id, reported_user_id)
```

Both identity columns are nullable with `ON DELETE SET NULL` so account deletion (GDPR erasure) anonymizes the audit row rather than dropping it. `reason` capped at 1000 chars to prevent large-payload abuse. The UNIQUE constraint enforces at most one report per (reporter, target) pair; `report_user` RPC uses `INSERT ... ON CONFLICT (reporter_user_id, reported_user_id) DO UPDATE SET reason = EXCLUDED.reason, created_at = now()` so legitimate "update reason" use cases work while preventing audit-table flood. Postgres treats NULLs as distinct in unique indexes — anonymized rows (reporter_user_id IS NULL) coexist without colliding.

RLS: writes go only through the `report_user` RPC; SELECT denied to all `authenticated` (table is admin-only at the Postgres role level). `report_user(target uuid, reason text) returns void` is SECURITY DEFINER for the same reason as `block_user` / `unblock_user`: no INSERT policy is granted to authenticated, so an INVOKER-mode RPC's INSERT would be RLS-rejected. The RPC sets `reporter_user_id = auth.uid()` explicitly, so authorization is preserved.

No triggers, no fan-out, no admin tool, no notification. Explicitly documented in code and migration comments to prevent later assumptions.

**Alternative considered:** omit reporting until a moderation pipeline is built. Rejected per user direction — capture now so paired Block+Report UX is in place; future moderation work can read the audit log.

### Decision: Code layout under `src/features/friendships/`

- `data/models/user-block-schemas.ts` — Zod schema for row (with `unblocked_at` nullable), inferred type.
- `data/models/abuse-report-schemas.ts` — minimal schema for the report payload.
- `domain/entities/user-block.ts`, `abuse-report.ts` — type re-exports.
- `domain/repositories/user-block-repository.ts` — interface: `listActive()`, `listBlockedUsers()`, `block(targetUserId)`, `unblock(targetUserId)`, `isBlockedBy(targetUserId)`, `report(targetUserId, reason)`.
- `data/repositories/user-block-repository-impl.ts` — Supabase impl mapping RPC errors to typed exceptions (`BlockCooldownError`, `BlockAlreadyExistsError`).
- `presentation/stores/user-blocks-store.ts` — Pinia composition store with state, realtime channel lifecycle, `isBlockedBy` cache (per-target boolean, 5-minute TTL, invalidated on auth change and on visibility-change), plus `blockedUserInfo` map (userId → phone + names) and `blockedPhones` derived Set for UI consumers.
- `presentation/components/blocked-list.vue` — Blocked tab content.
- `presentation/components/block-confirm-dialog.vue` — **inline** confirmation panel (not a modal) including unfriend warning + optional "Also report" toggle + reason input. Inline placement matches the existing delete-confirmation pattern (e.g. contact removal) so block confirmations have a consistent UX across mobile and desktop.

### Decision: `list_blocked_users()` RPC — identity resolution for blocker's own blocks (SECURITY DEFINER)

Discovery RPCs (`find_users_by_phones`, `find_phones_by_user_ids`, `get_user_names_by_ids`) filter bidirectionally on active blocks, so a blocker cannot resolve phone or name for users they themselves have blocked. The UI still needs to display these identities — for the Blocked tab, for the blocked-status badge on contact rows, and to hide stale "send friend request" affordances. Rather than weakening the bidirectional discovery filter, expose a dedicated SECURITY DEFINER RPC:

```sql
list_blocked_users() returns table (user_id uuid, phone text, first_name text, last_name text)
```

Returns one row per user the caller has actively blocked (`blocker_user_id = auth.uid() AND unblocked_at IS NULL`), joined to `auth.users` for phone and `public.user_profile` for names. No parameters — the result set is scoped to the caller. `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated;`.

The store calls this in lockstep with `listActive()` on every `fetchBlocks` (initial load, realtime change, post-block, post-unblock).

### Decision: Block visibility on contacts (badge + button hiding)

The user-blocks store exposes a derived `blockedPhones: Set<string>` (E.164) built from `blockedUserInfo`. UI surfaces consume this to:

- **Contact list and contact detail**: render a red `block` icon next to the contact name when any of the contact's phone methods (normalized to E.164) is in `blockedPhones`. Same `BaseTooltip` + icon pattern as the friend badge — different color (`--color-error`).
- **Contact detail Block action**: hide the Block button and inline confirm panel entirely when the contact resolves to a blocked user (by `linkedFriendUserId` ∈ `blockedUserIds` OR any contact phone ∈ `blockedPhones`).
- **Pending request rows**: hide the Block button on a row whose sender is already in `blockedUserIds`.
- **Connect-prompt (send-friend-request affordance)**: hide whenever EITHER `is_blocked_by(target)` is true (target blocked caller) OR `target ∈ blockedUserIds` (caller blocked target). Reactivity through `blockedUserIds` ensures the prompt disappears immediately after the user confirms a block, without remount.

### Decision: Friendships-store refresh as defensive backup after `block_user`

`block_user` cascades `friendships` DELETE + `friend_requests` UPDATE inside the same transaction. The friendships-store subscribes to realtime on both tables and should auto-refresh, but realtime delivery is racy and lossy (reconnect windows, missed events). After a successful `block` call, the user-blocks-store explicitly invokes `useFriendshipsStore().fetchAll()` so the pending-request row disappears from the UI synchronously with the block confirmation — independent of whether the realtime event lands.

### Decision: Sender-side cache TTL 5 minutes + multi-signal invalidation

- TTL 5 minutes per cached `isBlockedBy(target)` boolean.
- Invalidate on `document.visibilitychange` → visible (user returning to tab).
- Invalidate on auth change.
- **Server-rejection-driven invalidation**: when a `friend_requests` INSERT against target X is rejected by the server with a recognized block error (Postgres RLS denial / dedicated error code from the policy), the client maps that error to:
  1. Set `isBlockedByCache[X] = true` immediately.
  2. Hide the send affordance toward X in the current view.
  3. Show a generic "Could not send request" snackbar (do not disclose block).
- **Opportunistic invalidation** from existing realtime channels:
  - On `friendships` DELETE event involving target X, invalidate `isBlockedByCache[X]`.
  - On `friend_requests` UPDATE event where a request involving X moves to a terminal status without local user action, invalidate `isBlockedByCache[X]`.
  These are lossy signals (stranger-block has no such event), so the rejection-driven path remains the hard fallback.

Server-side INSERT remains the source of truth for any cache miss or stale window.

### Decision: Cooldown surfaced via i18n key with `{hours}` interpolation

Single key for the cooldown message, e.g. `blocks.cooldown.remaining` = "Available again in {hours} h". Remaining hours computed client-side from row timestamps and rounded up. Server returns seconds remaining in error detail; client converts.

## Risks / Trade-offs

- **Rewriting 5 discovery RPC bodies in one migration**: risk of regression in any of those code paths → Mitigation: keep argument signatures identical; add regression tests covering all five RPCs with a "blocked" and "not blocked" scenario; `supabase db reset` verifies all migrations from clean state.
- **Atomic cascade in `block_user` is complex**: many side effects → Mitigation: PL/pgSQL function is implicitly transactional; explicit `BEGIN`/`COMMIT` not needed but every UPDATE/INSERT is exception-safe; tests cover the four cascade variants (stranger / pending only / friendship only / both).
- **Cooldown UX cliff**: user blocks, immediately wants to unblock (regret), forced to wait 48h → trade-off accepted; the confirmation dialog discloses the cooldown so the user can decide before committing.
- **Concurrent block/unblock from multiple devices**: `BlockAlreadyExistsError` (from `block`) and `NotBlockedError` (from `unblock`) are treated as silent success client-side because end-state matches user intent. Cooldown errors remain surfaced.
- **`abuse_reports` with no pipeline** could give users false expectation of moderation → Mitigation: UI copy uses neutral language like "Submit report" without promising action; do not surface "your report is being reviewed".
- **Cache TTL still allows brief stale window**: blocked user could see send affordance for up to 5 minutes → server INSERT rejects, client error UX shows generic failure (do not reveal block).
- **Re-block updates same PK row**: realtime subscribers see UPDATE rather than DELETE+INSERT — store reducer must handle UPDATE events that flip `unblocked_at` null↔non-null and treat each transition as add-to / remove-from the active list.
- **Silent removal is inferable by the blocked user**: when A blocks B, B's realtime subscribers see the `friendships` DELETE and the `friend_requests` UPDATE to `denied`. We do not (and structurally cannot) hide these events without breaking the same realtime contract used elsewhere. The UX matches a normal unfriend + decline — indistinguishable from those actions in isolation. Accepted trade-off (matches IG / WhatsApp behavior).

## Migration Plan

1. `supabase migration new add_user_blocks_and_reporting`.
2. Migration content (initial file `20260521141737_add_user_blocks_and_reporting.sql`):
   - `user_blocks` table + CHECK + indexes.
   - `abuse_reports` table.
   - RLS on both tables (SELECT only; writes are RPC-mediated).
   - Functions: `is_blocked_by`, `block_user`, `unblock_user`, `report_user`, `send_friend_request`.
   - DROP + CREATE the `friend_requests` INSERT policy with the new block predicate.
   - REPLACE three discovery RPC bodies (`find_users_by_phones`, `find_phones_by_user_ids`, `get_user_names_by_ids`) with bidirectionally block-filtered versions (CREATE OR REPLACE FUNCTION — argument signatures unchanged). `find_user_by_phone` + `is_phone_registered` exempt.
   - Add `user_blocks` to `supabase_realtime` publication with `REPLICA IDENTITY FULL`.
3. Follow-up migrations (additive, fix-forward — never edit prior files):
   - `20260522045948_block_user_security_definer.sql`: convert `block_user` and `unblock_user` from SECURITY INVOKER to SECURITY DEFINER (RLS rejected the in-RPC INSERT/UPDATE because no INSERT/UPDATE policies are granted on `user_blocks`).
   - `20260522052725_list_blocked_users.sql`: add `list_blocked_users()` RPC for the blocker to resolve identity (phone + names) of their own blocked users, which the bidirectional discovery filter intentionally hides elsewhere.
   - `20260522054514_report_user_security_definer.sql`: convert `report_user` from SECURITY INVOKER to SECURITY DEFINER for the same RLS reason.
4. `supabase db reset` locally; verify schema + policies + each RPC.
5. Implement client code + tests.
6. `npm run test && npx eslint . --fix && npm run type-check`.
7. Manual smoke locally exercising all cascade variants + cooldown.
8. Prompt user to `supabase db push` to prod (not run unprompted).
9. Deploy frontend via existing release-please flow.

**Rollback:** new migration is additive plus policy/function replacements. Forward-fix preferred; a rollback migration would restore the prior INSERT policy on `friend_requests` and the prior discovery RPC bodies, and drop the new tables/functions.

## Open Questions

- Reason text: free-form or enum? Default: free-form `text` (capture is the goal, not categorization). Revisit when moderation pipeline is built.
- Should the Blocked tab show blocked-since date? Default: yes, relative ("3 days ago"), confirm during UI implementation.
- Should `unblock_user` purge the inactive row after cooldown elapses (housekeeping)? Default: leave it; rows are tiny, retention helps any future moderation audit.
