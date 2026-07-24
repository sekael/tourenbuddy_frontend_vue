## Context

`create_tour_full` and `update_tour_full` are `SECURITY`-defined SQL functions in the
baseline schema (`supabase/migrations/20260101000000_initial_schema.sql`). Both take
the full tour field set **including `p_gpx_filepath`** but **not** visibility;
`create_tour_full` inserts the `tours` row + `tour_partners`, `update_tour_full`
updates them. Visibility is set separately (`patchVisibility` → `UPDATE tours SET
visibility`), and the GPX filepath is patched after the storage upload
(`patchGpxFilepath`), because the filepath isn't known until the upload returns.

`tours-store.ts` therefore issues up to four writes per create and two per update.
The standalone `setVisibility` action is a *different* concern — a user toggle that
also runs a tour-links eviction snapshot + friendship-facing dispatch — and is **not**
touched by this change.

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

### D3 — `update_tour_full` stays update-only and separate from create
`update_tour_full` remains a plain `UPDATE … WHERE id = p_id`. If the row is gone it
affects 0 rows and makes no change — it **never inserts**, so a replayed update
against a server-deleted tour cannot resurrect it (the caller detects 0-rows and, in
`offline-write-sync`, dead-letters). Create and update stay **two functions**, not one
upsert, precisely so "insert-allowed" (create) and "update-only" (update) are
distinct — a merged upsert could not express the anti-resurrection gate.
- The store may read the affected-row count (or `RETURNING`) to distinguish
  "updated" from "row gone"; the RPC returns void today, so add a boolean/rowcount
  return if the update-only-miss needs to be observable to callers.

### D4 — GPX uploads first; filepath into the RPC; best-effort preserved
`createTourFromDraft` / `updateTour` upload the GPX to its deterministic
user+tour-prefixed path (the path is derivable from `userId` + tour `id`, both known
before the RPC) and pass the resulting filepath as `p_gpx_filepath`. Upload failure
is swallowed exactly as today (warn + continue with null filepath) — the tour write
still happens. This removes the trailing `patchGpxFilepath` and folds GPX into the
single call.
- *Why upload first, not after?* So the filepath is known at RPC time — that is the
  whole reason `patchGpxFilepath` existed as a second write.

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
- **Changing a void RPC to return a rowcount/bool (D3).** Only needed if callers must
  observe update-only-miss; scoped to what `offline-write-sync` needs. Additive to the
  return type, existing callers ignore it.

## Open Questions

- Whether `update_tour_full` needs to **return** an updated-row indicator now, or
  whether `offline-write-sync` can detect a missing row another way (e.g. a prior
  existence check). Default: add a lightweight boolean return now, since it is cheap
  and the consumer is already planned.
