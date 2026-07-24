## 1. Git Setup

- [ ] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/245-atomic-tour-write-rpcs`

## 2. Migration — atomic idempotent RPCs (local-first)

- [ ] 2.1 `supabase migration new atomic_tour_write_rpcs` → in the new file: `DROP FUNCTION public.create_tour_full(<old signature>)` and `DROP FUNCTION public.update_tour_full(<old signature>)` (exact arg lists copied from the baseline), then `CREATE FUNCTION` both with a new trailing `p_visibility text DEFAULT NULL`
- [ ] 2.2 `create_tour_full` body: `INSERT INTO tours (id, …, visibility) VALUES (p_id, …, COALESCE(p_visibility,'friends')) ON CONFLICT (id) DO NOTHING`; if 0 rows inserted (already exists) `RETURN` early WITHOUT inserting `tour_partners` (idempotent replay, design D2). Keep accepting `p_gpx_filepath`
- [ ] 2.3 `update_tour_full` body: keep it `UPDATE … WHERE id = p_id` (update-only, never inserts); set `visibility = COALESCE(p_visibility, visibility)` (untouched when null, D1); accept `p_gpx_filepath`. Return a boolean/rowcount indicating whether a row was updated (design D3/D5), so callers can detect a gone row
- [ ] 2.4 Re-issue Data-API grants in the same migration: `GRANT ALL ON FUNCTION public.create_tour_full(<new sig>) TO anon, authenticated, service_role;` and the same for `update_tour_full`
- [ ] 2.5 `supabase db reset` — verify both functions replace cleanly (no leftover overload), tours create/update still work locally

## 3. Repository (`tours-repository-impl.ts`)

- [ ] 3.1 `createTourWithPartners` — accept optional `visibility` + `gpxFilepath`, pass as `p_visibility` / `p_gpx_filepath` to `create_tour_full`
- [ ] 3.2 `updateTour` — accept optional `visibility` + `gpxFilepath`, pass through; surface the update-only-miss (return the boolean/rowcount from 2.3)
- [ ] 3.3 `patchVisibility` / `patchGpxFilepath` — LEAVE in place (still used by `setVisibility` and any other callers); they simply drop out of the create/update happy path

## 4. Store (`tours-store.ts`)

- [ ] 4.1 `createTourFromDraft` — reorder to: upload GPX first (best-effort, deterministic path) → single `create_tour_full` call with visibility + gpx filepath. Remove the follow-up `patchVisibility` and `patchGpxFilepath` writes. Leave the `notifyTourChanged` / partner logic after the single call unchanged
- [ ] 4.2 `updateTour` — upload GPX first (best-effort) → single `update_tour_full` call with visibility + gpx filepath. Remove the separate `patchVisibility` write and its "update_tour_full intentionally leaves visibility untouched" comment. Leave the tour-links eviction snapshot + `notifyTourChanged` logic (already after the single mutating call) unchanged
- [ ] 4.3 `setVisibility` — UNTOUCHED (standalone toggle + eviction snapshot preserved)

## 5. Tests (edge cases + failures only)

- [ ] 5.1 Repository (mock supabase RPC): create passes `p_visibility` + `p_gpx_filepath`; update omitting visibility passes null (so COALESCE leaves it); update surfaces the row-not-updated case
- [ ] 5.2 Store: GPX upload failure during create/update still issues the RPC (best-effort) with null filepath; no `patchVisibility`/`patchGpxFilepath` calls remain on the happy path
- [ ] 5.3 Idempotency (integration against local DB if feasible, else documented manual): calling `create_tour_full` twice with the same `p_id` leaves one tour + one partner set
- [ ] 5.4 `npm run test` — all pass

## 6. Finalize

- [ ] 6.1 `npx eslint . --fix` — zero warnings
- [ ] 6.2 `npm run type-check` — clean
- [ ] 6.3 `supabase db push` — prompt the user (do NOT run unprompted); confirm applied to prod before merge, since the frontend calls the new RPC signature
- [ ] 6.4 Prompt user to commit (do NOT commit) with message: `refactor(tours): atomic idempotent create/update RPCs (#245)`
- [ ] 6.5 Prompt user to push the branch and open a PR to `main`
