## Why

Tour create/update in `tours-store.ts` already upload the GPX **first** (the form
uploads at file-pick time and passes the resulting filepath into the RPC via
`draft.gpxFilepath`), so `create_tour_full` / `update_tour_full` already persist the
GPX filepath **inside** the single RPC. The one write that is still a **separate,
non-atomic follow-up** is `patchVisibility` — a trailing `UPDATE tours SET
visibility` on create (when the choice isn't the `friends` default) and on the
form-edit path (when visibility changed). That extra write can half-succeed, leaving
a tour with the wrong visibility, and the online path has no transaction spanning it.

Two dead artifacts also survive from an older flow: the store's `if (gpxFile) { …
patchGpxFilepath }` branch in `createTourFromDraft` (the `gpxFile` argument is
**always `null`** — `tour-form.vue` emits `null` and it flows unchanged through
`map-page.vue`), and `repository.patchGpxFilepath`, whose only caller is that dead
branch. The branch is also an *atomicity hazard*: if ever reached it would do a
second, non-atomic write after the create RPC — the exact anti-pattern this change
removes.

This refactor folds visibility into the two RPCs (making create/update genuinely
single-write and all-or-nothing), makes `create_tour_full` **idempotent by id**, and
makes `update_tour_full` observably **update-only**. That is valuable on its own and
is **also a prerequisite for `offline-write-sync`**: safe replay of a queued mutation
requires each write to be **one idempotent call**, not a multi-step sequence a partial
retry would corrupt. This change lands first, on its own branch, and is independently
shippable. The replay/queue engine itself is **not** in this change — only the
primitives it will lean on.

## What Changes

- **`create_tour_full` gains `p_visibility` and becomes idempotent.** An optional
  `p_visibility` param sets visibility in the same call (removing the separate
  `patchVisibility` on create; `visibility = COALESCE(p_visibility, 'friends')` — the
  literal matches the column default, noted with a `ponytail:` comment so the two
  don't silently diverge). The tour `INSERT` uses `ON CONFLICT (id) DO NOTHING` and
  the function **returns early if the row already existed** (`IF NOT FOUND THEN
  RETURN`), so replaying the same client-UUID create is a safe no-op that does not
  re-insert partners. Stays `RETURNS void` — no consumer needs an insert-vs-no-op
  signal (online ids are fresh UUIDv4; replay only needs the end state, which is
  identical either way).
- **`update_tour_full` gains `p_visibility`, stays update-only, and returns a
  boolean.** An optional `p_visibility` sets visibility atomically (`visibility =
  COALESCE(p_visibility, visibility)` — omitted → untouched, preserving today's
  behaviour). The body becomes a `SELECT user_id … INTO` **branch**, not a single
  `WHERE id = p_id AND user_id = auth.uid()`, so it distinguishes two cases the old
  single-predicate form conflates:
  - **row absent** → `RETURN false` (soft; the online store surfaces "edit failed"
    and aborts before its optimistic state rewrite; `offline-write-sync` will
    dead-letter). Never inserts, so it cannot resurrect a server-deleted tour.
  - **row present but `user_id <> auth.uid()`** → `RAISE` (hard error, unchanged from
    the baseline). This is a state the app should never reach; it stays a throw, not a
    soft boolean.
- **Delete the dead GPX-after-create path.** Remove the store's `if (gpxFile) { …
  patchGpxFilepath }` branch and drop the always-`null` `gpxFile` argument end-to-end
  (`createTourFromDraft` → `performCreate` → `handleTourCreated` → the form's
  `emit('submit', …)`). `preUploadedTourId` **stays** (it carries the pick-time upload
  id so the GPX path matches the tour id). `repository.patchGpxFilepath` is then
  **deleted** — its only caller was that branch.
- **The standalone `setVisibility` toggle is preserved unchanged.** It keeps its
  tour-links eviction snapshot + friendship-facing dispatch and its own
  `repository.patchVisibility` call. `p_visibility` on the RPCs is *additive* for the
  atomic create/update case; it does **not** remove or bypass `setVisibility`.
  `repository.patchVisibility` therefore **stays** (still used by `setVisibility`).
- **Migration** (local-first): both functions change signature (new param) and
  `update_tour_full` changes return type, so each is `DROP`ped and re-`CREATE`d in a
  new migration file, with Data-API grants re-applied. No dependents (nothing else in
  the schema calls them), so no `CASCADE`. No table/RLS changes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tours`: adds guarantees that a tour create/update is a single atomic call that
  also sets visibility, that create is idempotent by id, and that update is
  update-only (never resurrects) with an observable not-found result. The standalone
  visibility-toggle behaviour is unchanged.

## Impact

- **Migration (`supabase/migrations/<ts>_atomic_tour_write_rpcs.sql`):** `DROP` +
  `CREATE` `create_tour_full` (idempotent, `p_visibility`) and `update_tour_full`
  (update-only branch, `p_visibility`, `RETURNS boolean`); re-`GRANT ALL … TO anon,
  authenticated, service_role` on both with the new signatures. Applied to LOCAL
  Supabase first (`supabase db reset`), pushed to prod only after review — and the
  push must precede merge, since the new frontend calls the new signature.
- **Repository (`tours-repository-impl.ts`):** `createTourWithPartners` accepts
  optional `visibility`, passes `p_visibility`. `updateTour` accepts optional
  `visibility`, passes it, and **returns** the boolean (row-updated) so callers can
  detect a gone row. `patchGpxFilepath` **deleted** (dead). `patchVisibility`
  **stays** (used by `setVisibility`).
- **Store (`tours-store.ts`):** `createTourFromDraft` drops the `patchVisibility`
  follow-up (folded into the RPC) and the dead `gpxFile`/`patchGpxFilepath` branch +
  the `gpxFile` param. `updateTour` drops its `patchVisibility` follow-up and its
  "intentionally leaves visibility untouched" comment, and **checks the boolean** —
  `false` ⇒ set `error` / throw and skip the eviction dispatch + optimistic
  `tours.value` rewrite (preserving today's user-visible "edit failed"). `setVisibility`
  untouched.
- **Callers (`map-page.vue`):** `performCreate` / `handleTourCreated` lose the
  `gpxFile` param (mechanical).
- **Testing:** the SQL guarantees (idempotency, update-only, auth split) are **not
  unit-testable** — the suite mocks the RPC and there is no Postgres harness. Assert
  what the seam controls (params passed, `null` visibility on omit, store aborts on
  `false`); verify the SQL semantics via a documented manual `supabase db reset` +
  double-`create_tour_full` check. A real-Postgres regression test is a follow-up
  owned by `offline-write-sync` (the PR that depends on the semantics holding).
- **No new npm dependency. No Worker change. No frontend UI change** (behaviour is
  identical to the user; the win is atomicity + idempotency).
