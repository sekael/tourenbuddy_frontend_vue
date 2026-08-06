## Context

`create_tour_full` and `update_tour_full` are `SECURITY`-defined SQL functions in the
baseline schema (`supabase/migrations/20260101000000_initial_schema.sql`). Both take
the full tour field set **including `p_gpx_filepath`** but **not** visibility;
`create_tour_full` inserts the `tours` row + `tour_partners`, `update_tour_full`
updates them. Visibility is set separately (`patchVisibility` → `UPDATE tours SET
visibility`), and the GPX filepath is patched after the storage upload
(`patchGpxFilepath`), because the filepath isn't known until the upload returns.

In the real form path the GPX is **already** uploaded first (at file-pick time in
`tour-form.vue`) and its filepath is **already** passed into the RPC via
`draft.gpxFilepath`, so the GPX filepath is written *inside* the single call today.
The only genuinely-separate, non-atomic follow-up write is `patchVisibility` (on
create when non-default, and on the form-edit path when visibility changed). The
store's `if (gpxFile) { … patchGpxFilepath }` create branch is **dead** — `gpxFile`
is always `null` — and `patchGpxFilepath`'s only caller is that dead branch.

The standalone `setVisibility` action is a *different* concern — a user toggle that
also runs a tour-links eviction snapshot + friendship-facing dispatch — and is **not**
touched by this change (it keeps its own `patchVisibility` call).

## Goals / Non-Goals

**Goals**
- Tour create and update are each a **single atomic RPC** that also sets visibility
  and the GPX filepath.
- `create_tour_full` is **idempotent by id** — replaying the same client-UUID create
  is a safe no-op.
- `update_tour_full` is **update-only** — it never inserts, so it can't resurrect a
  deleted row.
- The online user-visible behaviour is **unchanged**; GPX stays best-effort.

**Non-Goals**
- No change to the standalone `setVisibility` toggle or its eviction/notification
  side effects.
- No change to `tour_partners` semantics, RLS, or any table.
- No offline/queue logic — that is `offline-write-sync`; this change only makes the
  RPCs it depends on.
- No merging of create and update into one upsert (kept separate deliberately, D3).

## Decisions

### D1 — Add `p_visibility`, apply only when provided
Both functions gain an optional trailing `p_visibility text DEFAULT NULL`. Create
sets `visibility` from it (falling back to the table/`friends` default when null).
Update sets `visibility = COALESCE(p_visibility, visibility)` so a caller that omits
it leaves the existing value untouched — this exactly preserves today's
`update_tour_full` behaviour ("intentionally leaves visibility untouched") for
callers that don't pass it, while letting the form-edit path set it atomically.
- *Why COALESCE, not always-set?* Several existing callers of `update_tour_full` do
  not intend to change visibility; always-setting would clobber it to null.

### D2 — Idempotent create via `ON CONFLICT (id) DO NOTHING` + early return
`create_tour_full`'s `INSERT INTO tours … VALUES (p_id, …) ON CONFLICT (id) DO
NOTHING`. If `0` rows were inserted (the row already exists — a replayed create),
the function **returns immediately**, skipping the `tour_partners` insert. Because
the function is transactional, there is no partial state to reconcile: either the
original call committed the row + partners together, or it rolled back and this call
inserts fresh. The early return makes a retry a clean no-op.
- *Why skip partners on conflict?* If the tour already exists it was created by the
  original successful call, which already inserted its partners; re-inserting would
  duplicate or conflict. Skip is correct.
- *This is what `offline-write-sync` relies on* for `op=create` replay safety.

### D3 — `update_tour_full` stays update-only, splits not-found (soft) from not-owned (hard)
`update_tour_full` never inserts, so a replayed update against a server-deleted tour
cannot resurrect it. Create and update stay **two functions**, not one upsert,
precisely so "insert-allowed" (create) and "update-only" (update) are distinct — a
merged upsert could not express the anti-resurrection gate.

The baseline body `raise`s `'Tour not found or access denied'` for *both* a missing
row and a not-owned row — and that `raise` embeds the ownership gate (`user_id =
auth.uid()`), which is the **only** thing stopping cross-user writes since the
function is `SECURITY DEFINER` (table RLS is bypassed). A naive rewrite to a single
`UPDATE … WHERE id = p_id AND user_id = auth.uid()` + rowcount would either drop the
gate or conflate the two failures. So the body becomes a `SELECT user_id INTO`
**branch**:

- **row absent** (`NOT FOUND`) → `RETURN false`. Soft: the online store surfaces
  "edit failed" and aborts *before* its optimistic `tours.value` rewrite and eviction
  dispatch (otherwise: silent data loss + a phantom row); `offline-write-sync` will
  dead-letter. Not-found is expected under concurrency/replay, so it's data, not an
  exception.
- **row present but `user_id <> auth.uid()`** → `RAISE`. Hard: this is a state the
  app should never reach; keeping it a throw (unchanged from baseline) preserves the
  auth gate as a loud failure rather than a silent no-op.
- **owned** → `UPDATE`, refresh partners, `RETURN true`.

`RETURNS boolean` is not speculative: the online store needs it **now** to preserve
today's throw-on-missing behaviour (translating `false` → abort). The offline
dead-letter consumer is the *second* reader, later.

### D4 — GPX-first is already done; delete the dead after-create path instead
The "upload GPX first, pass the filepath into the RPC" work **already exists**:
`tour-form.vue` uploads at file-pick time and the filepath rides into
`create_tour_full` / `update_tour_full` via `draft.gpxFilepath` (repo already passes
`p_gpx_filepath`). So there is **no reorder to do**. What remains is a *cleanup*:
- Delete the store's `if (gpxFile) { uploadGpx; patchGpxFilepath }` create branch. It
  is dead (`gpxFile` is always `null`) and an atomicity hazard (a second write after
  the RPC).
- Drop the always-`null` `gpxFile` argument **end-to-end** (`createTourFromDraft` →
  `performCreate` → `handleTourCreated` → the form `emit('submit', …)`). A dead param
  that's always `null` is a false affordance ("you can pass a File here" — you can't);
  the smallest *honest* interface wins over the smallest diff. `preUploadedTourId`
  stays — load-bearing (pick-time upload id → tour id).
- Delete `repository.patchGpxFilepath` — its only caller was that branch.

GPX stays best-effort exactly as today (upload failure → tour still written, filepath
null); that behaviour lives in the form's pick-time upload, untouched.

### D5 — Migration: DROP + CREATE (signature change), re-grant
Adding a parameter changes each function's signature, so `CREATE OR REPLACE` would
create a second overload rather than replace. The migration therefore `DROP FUNCTION
public.create_tour_full(<old signature>)` / `…update_tour_full(<old signature>)` then
`CREATE FUNCTION` with the new signature, and re-issues `GRANT ALL ON FUNCTION … TO
anon, authenticated, service_role` (the Data-API grants the baseline had). New
migration file only — the baseline is immutable. Verified with `supabase db reset`
locally before any `db push`.

## Risks / Trade-offs

- **Overload ambiguity if DROP is skipped.** Forgetting the `DROP` would leave two
  `create_tour_full` overloads and make PostgREST calls ambiguous. Mitigation: the
  migration explicitly drops the old signature first (D5); verified by `db reset`.
- **`COALESCE(p_visibility, visibility)` vs an explicit "clear to null".** Visibility
  is a non-null enum with a default, so "clear to null" is not a real operation;
  COALESCE is safe. If a nullable field ever needed distinguishing "unset" from
  "set-null", COALESCE would be wrong — not the case here.
- **Idempotent-create hiding a real duplicate.** `ON CONFLICT DO NOTHING` silently
  no-ops a genuine id collision. Client ids are UUIDv4 — collision probability is
  negligible; and a colliding *intentional* re-create isn't a supported flow.
- **Changing `update_tour_full`'s return type void → boolean (D3).** Requires DROP +
  CREATE (return-type change can't `CREATE OR REPLACE`) — already the plan for the
  signature change. The repo's `.rpc()` reads `data`; the store must act on `false`
  (see D3) or a concurrent-delete edit silently "succeeds". Not speculative: the
  online store consumes it immediately.
- **Removing the `raise` for the not-found case (D3).** The online path previously
  threw on a missing row; it now gets `false` and must translate that back to an
  abort. Missing that check is the main correctness risk of this change — covered by
  test 5.2.

### D6 — Testing: assert the seam now, defer real-Postgres to the consumer
The SQL guarantees (idempotency, update-only, not-found/not-owned split) are **not**
exercisable in the current suite — every tours test mocks the RPC and there is no
Postgres harness. Rather than bolt on a testcontainers/pgTAP setup (a separate
infra change, out of scope for a low-risk DDL PR), assert what the frontend seam
controls — repo passes `p_visibility`/`p_gpx_filepath`, update-omitting-visibility
sends `null`, store aborts on a `false` return — and verify the SQL semantics via a
documented manual `supabase db reset` + double-`create_tour_full` check, with a
`-- idempotency:` comment in the migration so the guarantee is legible to the next
migration author. A real-Postgres regression test is a follow-up owned by
`offline-write-sync`, the PR that actually depends on the semantics holding.

## Open Questions

- *(resolved)* `update_tour_full` returns a boolean now — the online store is an
  immediate consumer (translates `false` → abort), so it is not speculative. See D3.
