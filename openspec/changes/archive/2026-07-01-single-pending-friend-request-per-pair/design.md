## Context

`friend_requests` rows are directional (`from_user_id`, `to_user_id`). The only anti-duplicate guard is:

```sql
CREATE UNIQUE INDEX friend_requests_pending_pair_idx
  ON friend_requests (from_user_id, to_user_id) WHERE status = 'pending';
```

Because `(A,B)` and `(B,A)` are distinct ordered tuples, two opposing pending rows are permitted. The `friendships` table already treats a pair as unordered (`friendships_unordered_pair_idx` on `LEAST/GREATEST`, and `accept_friend_request` inserts with `ON CONFLICT (LEAST, GREATEST) DO NOTHING`), so once a friendship forms it is well-formed — but the *request* layer can leave a stale opposing pending row behind after one side is accepted.

Two entry points create the duplicate:
1. `friendships-store.sendRequest` → `send_friend_request` RPC inserts unconditionally.
2. `contacts-list-sheet.vue` gating computeds (`detailViewMatchedUserId`, `manualPromptUserId`) only exclude a match when a **pending outgoing** request or existing friendship exists — a **pending incoming** request from the target does not suppress the "Send request" affordance, so the user is invited to create the reciprocal.

## Goals / Non-Goals

**Goals:**
- Exactly one `pending` `friend_request` per unordered pair `{A,B}`, enforced declaratively in the DB.
- A "send toward someone who already requested me" affordance resolves the existing request (become friends) with an explicit disclaimer, instead of duplicating.
- Clean up any pre-existing dual-pending data as part of the migration and defensively in `accept_friend_request`.

**Non-Goals:**
- No change to how friendships themselves are keyed (`friendships` is already unordered and idempotent).
- No new notification dispatch types — reuse `notifyFriendRequestResponded`.
- No change to the block / cleanup cascade requirements beyond keeping them compatible with the new index.

## Decisions

### D1 — Unordered partial unique index (declarative source of truth)

Replace the directional index with:

```sql
CREATE UNIQUE INDEX friend_requests_pending_pair_idx
  ON friend_requests (LEAST(from_user_id, to_user_id), GREATEST(from_user_id, to_user_id))
  WHERE status = 'pending';
```

The DB — not client code — is the guarantee. This mirrors the existing `friendships_unordered_pair_idx` pattern, satisfying the project's declarative-integrity convention (enforce invariants with constraints, not trigger-only). Alternative (app-only dedupe) rejected: a custom client or race can still insert a duplicate.

Because a unique index cannot be created over existing violating rows, the migration **first dedupes**: for every pair with more than one pending row, keep the earliest (`created_at`, tie-break `id`) and set the rest to `status = 'cancelled', responded_at = now()`. Keeping the earliest preserves the original requester's intent and the row a recipient may already be looking at.

### D2 — `accept_friend_request` cancels the opposite-direction pending row

In the same transaction as the accept, after inserting the friendship:

```sql
update public.friend_requests
set status = 'cancelled', responded_at = now()
where from_user_id = v_to and to_user_id = v_from and status = 'pending';
```

Once D1 lands, dual-pending cannot be created going forward, so this is belt-and-suspenders for rows that predate the migration or slip through at edges. It is idempotent (no-op when no opposite row exists) and keeps the accept path a single total operation. Alternative (trust the index + one-time cleanup only) rejected as less robust for legacy data.

### D3 — Connect prompt gains an accept variant

The connect prompt is the single surface where the duplicate was born, so the fix lives there. **Detection is purely client-side, from store state** — the normal flow is: the target already has a settled pending request to the caller, which is present in `incomingRequests` (kept fresh by fetch + Realtime). When such an incoming request exists for `matchedUserId`, the prompt renders "Accept friend request" and calls `store.accept(incomingRequestId)` instead of `sendRequest`. On success it swaps to an inline generic **"You are now friends"** panel — the same structural pattern as the existing `sent` state (`state === 'sent'`), name-less to match the existing `requestSent` idiom and avoid threading a display name through three call sites. This keeps one component, one success idiom.

To drive this, the component needs to know the incoming request id for `matchedUserId`. The gating computeds in `contacts-list-sheet.vue` change from "hide when incoming pending" (they don't today) to "surface incoming-pending matches and pass the request id down". Concretely the prompt takes an optional `incomingRequestId` (or resolves it from the store by `matchedUserId`); when present it is in accept-mode, otherwise send-mode.

`notifyFriendRequestResponded(requestId)` already fires inside `store.accept`, so the responded notification to the original requester comes for free — no dispatch added at the component layer (keeps the push/Realtime separation requirement intact: dispatch stays inside the intent-bound store action).

### D4 — Concurrent cross-send is prevented by the index, not recovered in code

Two users can hit "send" toward each other in the same ~150ms instant, before either's Realtime echo of the other's request arrives — both clients see no incoming request, both render "Send", both call the RPC. The first insert succeeds; the second violates the unordered index (`23505`). This is the **only** situation not covered by client-side detection, and it is rare.

We deliberately do **not** write an auto-recovery path for it. The index already guarantees correctness (no duplicate can persist). The second sender simply gets a send-failure snackbar **whose copy prompts them to retry** ("Couldn't send — try again"). By the time they reopen the contact, Realtime has delivered the incoming request (within the debounce window), so the prompt now renders "Accept" naturally. Rationale (ponytail): the constraint does the correctness work; the existing Realtime flow self-heals the UI, so catching `23505` and orchestrating a refetch-and-resurface is code that runs almost never for no correctness gain. Rejected alternative: server-side merge of send+accept in `send_friend_request` — over-engineers a common RPC's contract to smooth one rare race.

## Risks / Trade-offs

- **Migration can't create the index if dedupe misses a case** → the dedupe CTE runs in the same migration immediately before `CREATE UNIQUE INDEX`; verified via `supabase db reset` against seeded dual-pending rows before push.
- **Dropping/recreating the index name** → keep the same index name so nothing else references a stale one; drop-then-create in one migration.
- **Accept-mode mis-detection** (showing "Accept" when no incoming pending actually exists) → the incoming request id is sourced from store state (`incomingRequests`, which Realtime keeps fresh); if absent, fall back to send-mode. Worst case is showing "Send", which the index + D2 still make safe.
- **Index build lock** → plain `CREATE UNIQUE INDEX` (not `CONCURRENTLY`) takes a transient `SHARE` lock that blocks writes to `friend_requests` for the sub-second build only, then releases on commit; steady-state cost is ordinary per-write btree maintenance on `pending` rows (microseconds, no locking). `CONCURRENTLY` is rejected — it cannot run inside the transactional migration and would sacrifice all-or-nothing atomicity for a lock that is trivial on this small, low-cardinality table.
- **i18n**: new keys (accept-request label, "you are now friends" disclaimer, retry-prompting send-failure copy) must exist in **every** locale (`en.json`, `de-CH.json`) or vue-i18n falls back to the key string.

## Migration Plan

1. New migration `supabase migration new single_pending_friend_request_per_pair`.
2. In it: dedupe dual-pending rows (D1) → `DROP INDEX` old → `CREATE UNIQUE INDEX` unordered → `CREATE OR REPLACE FUNCTION accept_friend_request` with the opposite-direction cancel (D2).
3. `supabase db reset` locally; verify with seeded opposing pending rows that dedupe leaves exactly one and the index blocks a fresh reciprocal insert.
4. `npm run test`, type-check, eslint.
5. `supabase db push` only after review (prompt user — not run unprompted).

**Rollback:** fix-forward only (migrations are immutable). A follow-up migration would restore the directional index if ever needed.

## Open Questions

_None._ All decisions were confirmed with the user in a design grill: unordered partial index (D1) with keep-earliest dedupe (reject cancel-both and reject mutual-send-auto-friendship); opposite-direction cancel in the accept RPC (D2), applied silently — the friendship + responded notification fully explain the outcome, no separate cancel signal; client-side accept detection from store state (D3) with a generic name-less "you are now friends" disclaimer; concurrent cross-send left to the index with a retry-prompting error, no code recovery and no server-side send/accept merge (D4); plain transactional `CREATE UNIQUE INDEX`, no `CONCURRENTLY`.
