## Context

`friendships` table currently uses `user_a_id` / `user_b_id` with a canonical-ordering invariant `user_a_id < user_b_id`. This was a deduplication trick: any unordered pair has exactly one valid representation, so the PK alone prevents duplicate friendships. The cost is opaque column names and a `least()/greatest()` dance in every RPC and read path.

Issue #111 asks for semantic names tied to the originating request: `request_user_id` (sender) and `response_user_id` (accepter). This rename also abandons the lexical-ordering invariant.

## Goals / Non-Goals

**Goals:**
- Self-describing column names that mirror `friend_requests.from_user_id` / `to_user_id`.
- Preserve all existing rows (rename is data-only; current `user_a_id` value becomes `request_user_id`, etc.) — but see Decisions for why this mapping is wrong and how we handle it.
- Keep the "one row per unordered pair" guarantee.

**Non-Goals:**
- Changing public API of repo / store / domain entities (field names in the domain entity may rename, but the surface stays internal to the friendships feature).
- Changing how `friend_requests` works.
- Backfilling correct semantics for legacy rows where `user_a_id`/`user_b_id` may not align with `from_user_id`/`to_user_id` (see Risks).

## Decisions

### Decision: Drop the canonical-ordering check

`request_user_id < response_user_id` would not hold in general — request direction is independent of UUID ordering. So the `check (user_a_id < user_b_id)` constraint must be dropped.

**Alternative considered:** keep canonical ordering and ignore the new semantic — rejected, the whole point of #111 is semantics.

### Decision: Enforce uniqueness via a functional unique index

After dropping `a < b`, the PK `(request_user_id, response_user_id)` no longer prevents duplicates `(X,Y)` and `(Y,X)`. Add:

```sql
create unique index friendships_unordered_pair_idx
  on public.friendships (least(request_user_id, response_user_id), greatest(request_user_id, response_user_id));
```

This preserves the "one friendship per unordered pair" invariant.

**Alternative considered:** rely on the `accept_friend_request` RPC being the only writer and trust application logic — rejected, defense in depth, RLS already blocks client writes but constraints belong in the schema.

### Decision: Backfill semantics from `friend_requests.request_id`

Existing `friendships` rows reference their originating request via `request_id`. The migration SHALL:

1. Rename columns (`user_a_id` → `request_user_id`, `user_b_id` → `response_user_id`).
2. For rows with non-null `request_id`, swap if `request_user_id <> friend_requests.from_user_id` so the columns match request semantics.
3. For rows with null `request_id` (orphaned from request soft-delete): leave as-is — the rename is then arbitrary but the unordered pair is still correct.
4. Drop the `user_a_id < user_b_id` check.
5. Add the functional unique index.

**Alternative considered:** plain rename without backfill — rejected, leaves `request_user_id` semantically meaningless for half the rows.

### Decision: Recreate (not alter) RPCs

`accept_friend_request`, `remove_friendship`, `find_phones_by_user_ids` all reference the old column names. Use `create or replace function` for each — same body shape, just new column refs and removal of `least()/greatest()` in the insert.

### Decision: Rename Zod / domain fields too

`friendship-schemas.ts` exposes `userAId` / `userBId`. Rename to `requestUserId` / `responseUserId` and update the repo mapper + any consumers (store + components). Keeps presentation aligned with DB semantics.

## Risks / Trade-offs

- **Risk: legacy rows where `request_id` is null have no truth source for role assignment** → Mitigation: accept; presentation never distinguishes the two roles, so arbitrary mapping is harmless. Document in migration comment.
- **Risk: forgetting a call site that destructures `userAId` / `userBId`** → Mitigation: ESLint will fail on the type rename; CI catches it.
- **Risk: deployed clients on old build query columns by old name** → Mitigation: PostgREST surfaces columns by current name only; old clients would have already broken on any schema change. Acceptable since this is a single-tenant deployment with PWA cache that refreshes.
- **Trade-off: functional unique index uses `least`/`greatest`** — slightly opaque, but standard Postgres pattern; cost is the same as the prior PK check.

## Migration Plan

1. New SQL migration `supabase/migrations/<date>_rename_friendship_columns.sql`:
   - `alter table public.friendships drop constraint <name of "a < b" check>` (look up name; default would be auto-generated, e.g. `friendships_check`).
   - `alter table ... rename column user_a_id to request_user_id;`
   - `alter table ... rename column user_b_id to response_user_id;`
   - Backfill swap where `request_id` known and order doesn't match.
   - `create unique index friendships_unordered_pair_idx on ... (least(...), greatest(...));`
   - `create or replace function accept_friend_request ...` (no `least/greatest` on insert).
   - `create or replace function remove_friendship ...` (delete by either ordering, using new column names).
   - `create or replace function find_phones_by_user_ids ...` (replace `user_a_id`/`user_b_id` refs).
   - Recreate `friendships_select` RLS policy on new column names (drop + create).
2. Update `friendship-repository-impl.ts` row mapper + `friendship-schemas.ts` field names.
3. Update store / components consuming the renamed fields (likely just the friendships feature).
4. Update unit tests.
5. Apply migration locally, run `npm run test`, run app smoke test (send/accept/remove friend flow).

**Rollback:** revert migration via a follow-up migration that renames back and re-adds the canonical check (after verifying current data still satisfies `a < b` — would only be true if no new rows wrote in `from_user_id`-ordered semantics where `from > to`).

## Open Questions

- Exact name of the auto-generated `a < b` check constraint — resolve by querying `pg_constraint` in the migration or running locally first to discover.
