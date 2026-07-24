## Why

Creating a tour today is a **4-write sequence** in `createTourFromDraft`
(`tours-store.ts`): `create_tour_full` (row + partners) → `patchVisibility` (a
separate `UPDATE` when the choice isn't the server default) → `uploadGpx` (storage)
→ `patchGpxFilepath` (another `UPDATE`). `updateTour` is similar: `update_tour_full`
then a separate `patchVisibility`. Each extra write is a step that can half-succeed,
leaving a tour with the wrong visibility or a null GPX path — and the online path has
no transaction spanning them.

This refactor collapses tour create/update to a **single atomic RPC** (+ a
best-effort GPX upload done *first*), which is valuable on its own — the online path
becomes all-or-nothing, no more half-applied tours. It is **also a prerequisite for
`offline-write-sync`**: that change replays queued mutations, and safe replay
requires each write to be **one idempotent call**, not a multi-step sequence that a
partial retry would corrupt (see `offline-write-sync` design DC0). This change lands
first, on its own branch, and is independently shippable.

## What Changes

- **`create_tour_full` gains `p_visibility` and becomes idempotent.** An optional
  `p_visibility` param sets visibility in the same call (removing the separate
  `patchVisibility` on create). The tour `INSERT` uses `ON CONFLICT (id) DO NOTHING`
  and the function **returns early if the row already exists**, so replaying the same
  client-UUID create is a safe no-op (needed by `offline-write-sync`).
- **`update_tour_full` gains `p_visibility`, stays update-only.** An optional
  `p_visibility` sets visibility atomically with the rest of the edit (removing the
  separate `patchVisibility` on the form-edit path). Visibility is only changed when
  `p_visibility` is non-null (`visibility = COALESCE(p_visibility, visibility)`), so
  callers that don't pass it leave it untouched — preserving today's behaviour. The
  function remains **update-only** (`WHERE id = …`; 0 rows affected if the row is
  gone) so it can never resurrect a deleted row.
- **GPX uploads first, filepath passed into the RPC.** `createTourFromDraft` /
  `updateTour` upload the GPX to its deterministic user+tour-prefixed path *before*
  the RPC and pass the resulting `p_gpx_filepath` into it — removing the trailing
  `patchGpxFilepath` write. GPX stays **best-effort** exactly as today (upload fails
  → the tour is still created/updated, filepath null).
- **The standalone `setVisibility` toggle is preserved unchanged.** The visibility
  toggle must remain independently available to users with all its consequences
  (tour-links eviction snapshot + friendship-facing effects). `p_visibility` on the
  RPCs is *additive* for the atomic create/update case; it does **not** remove or
  bypass `setVisibility` / `patchVisibility`.
- **Migration** (local-first): the two functions' signatures change (a new param), so
  each is `DROP`ped and re-`CREATE`d in a new migration file, with Data-API grants
  re-applied. No table/RLS changes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tours`: adds guarantees that a tour create/update is a single atomic call that
  also sets visibility and GPX filepath, that create is idempotent by id, and that
  update is update-only (never resurrects). The standalone visibility-toggle
  behaviour is unchanged.

## Impact

- **Migration (`supabase/migrations/<ts>_atomic_tour_write_rpcs.sql`):** `DROP` +
  `CREATE` `create_tour_full` and `update_tour_full` with the new `p_visibility`
  param and the idempotent-create / update-only / visibility-COALESCE bodies;
  re-`GRANT ALL … TO anon, authenticated, service_role` on both. Applied to LOCAL
  Supabase first (`supabase db reset`), pushed to prod only after review.
- **Repository (`tours-repository-impl.ts`):** `createTourWithPartners` /
  `updateTour` signatures accept optional visibility + gpx filepath and pass them to
  the RPC. `patchVisibility` / `patchGpxFilepath` **stay** (still used by
  `setVisibility` and any remaining callers) but drop out of the create/update happy
  path.
- **Store (`tours-store.ts`):** `createTourFromDraft` and `updateTour` reorder to
  upload-GPX-first → single RPC; remove their `patchVisibility` / `patchGpxFilepath`
  follow-up writes. `setVisibility` untouched. Notification / eviction-snapshot logic
  unchanged (it already runs after the single mutating call).
- **No new npm dependency. No Worker change. No frontend UI change** (behaviour is
  identical to the user; the win is atomicity + idempotency).
