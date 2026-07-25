## 1. Git Setup

- [ ] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/245-atomic-tour-write-rpcs`

## 2. Migration — atomic idempotent RPCs (local-first)

- [ ] 2.1 `supabase migration new atomic_tour_write_rpcs` → in the new file: `DROP FUNCTION public.create_tour_full(<old signature>)` and `DROP FUNCTION public.update_tour_full(<old signature>)` (exact arg lists copied from the baseline), then `CREATE FUNCTION` both with a new trailing `p_visibility text DEFAULT NULL`
- [ ] 2.2 `create_tour_full` body (still `RETURNS void`): `INSERT INTO tours (id, …, visibility) VALUES (p_id, …, COALESCE(p_visibility,'friends')) ON CONFLICT (id) DO NOTHING`; `IF NOT FOUND THEN RETURN` early WITHOUT inserting `tour_partners` (idempotent replay, design D2). Keep accepting `p_gpx_filepath`. Add a `-- ponytail:`/`-- idempotency:` comment: the `'friends'` literal matches the column default, and replaying a create must no-op
- [ ] 2.3 `update_tour_full` body → `RETURNS boolean`, `SELECT user_id INTO v_owner FROM tours WHERE id = p_id` branch (design D3): `NOT FOUND` → `RETURN false` (soft, gone); `v_owner <> auth.uid()` → `RAISE` (hard, cross-user — keep the baseline throw, it is the SECURITY DEFINER auth gate); else `UPDATE … WHERE id = p_id` with `visibility = COALESCE(p_visibility, visibility)` (untouched when null, D1), refresh partners, `RETURN true`. Never inserts. Keep accepting `p_gpx_filepath`
- [ ] 2.4 Re-issue Data-API grants in the same migration: `GRANT ALL ON FUNCTION public.create_tour_full(<new sig>) TO anon, authenticated, service_role;` and the same for `update_tour_full`
- [ ] 2.5 `supabase db reset` — verify both functions replace cleanly (no leftover overload), tours create/update still work locally

## 3. Repository (`tours-repository-impl.ts`)

- [ ] 3.1 `createTourWithPartners` — accept optional `visibility`, pass as `p_visibility` to `create_tour_full` (`p_gpx_filepath` already passed via `draft.gpxFilepath`)
- [ ] 3.2 `updateTour` — accept optional `visibility`, pass as `p_visibility`; return the boolean (row-updated) from `update_tour_full`'s `data` so callers can detect a gone row
- [ ] 3.3 `patchGpxFilepath` — DELETE (dead: only caller was the removed create branch, task 4.1). `patchVisibility` — LEAVE (still used by `setVisibility`)

## 4. Store (`tours-store.ts`)

- [ ] 4.1 `createTourFromDraft` — remove the follow-up `patchVisibility` write (fold into the `create_tour_full` call via `visibility`). Delete the dead `if (gpxFile) { uploadGpx; patchGpxFilepath }` branch and drop the `gpxFile` param end-to-end (`performCreate` / `handleTourCreated` / form `emit('submit', …)` in `map-page.vue` + `tour-form.vue`). Keep `preUploadedTourId`. Leave `notifyTourChanged` / partner logic unchanged
- [ ] 4.2 `updateTour` — pass `visibility` into the single `update_tour_full` call; remove the separate `patchVisibility` write + its "intentionally leaves visibility untouched" comment. Check the returned boolean: `false` ⇒ set `error` / throw and `return` BEFORE the eviction dispatch + optimistic `tours.value` rewrite (preserve today's "edit failed" + no phantom row). Leave the eviction snapshot / `notifyTourChanged` (after a successful update) unchanged
- [ ] 4.3 `setVisibility` — UNTOUCHED (standalone toggle + eviction snapshot + its `patchVisibility` preserved)

## 5. Tests (edge cases + failures only)

- [ ] 5.1 Repository (mock supabase RPC): create passes `p_visibility`; update omitting visibility passes `null` (so COALESCE leaves it); update surfaces the row-not-updated (`false`) case
- [ ] 5.2 Store: `updateTour` receiving `false` aborts — sets `error`, does NOT run eviction dispatch or optimistic `tours.value` rewrite; no `patchVisibility` call remains on the create/update happy path; no reference to a `gpxFile` param remains
- [ ] 5.3 SQL semantics NOT unit-testable (suite mocks the RPC, no Postgres harness) — documented manual check against local Supabase: (a) `create_tour_full` twice with same `p_id` ⇒ one tour + one partner set; (b) `update_tour_full` on a deleted id ⇒ `false`, no row; (c) `update_tour_full` on another user's id ⇒ raises. Real-Postgres regression test deferred to `offline-write-sync` (design D6)
- [ ] 5.4 `npm run test` — all pass

## 6. Finalize

- [ ] 6.1 `npx eslint . --fix` — zero warnings
- [ ] 6.2 `npm run type-check` — clean
- [ ] 6.3 `supabase db push` — prompt the user (do NOT run unprompted); confirm applied to prod before merge, since the frontend calls the new RPC signature
- [ ] 6.4 Prompt user to commit (do NOT commit) with message: `refactor(tours): atomic idempotent create/update RPCs (#245)`
- [ ] 6.5 Prompt user to push the branch and open a PR to `main`
