## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/242-calendar-availability`

## 2. Database — schema + owner RLS

- [x] 2.1 `supabase migration new create_user_availability`; define `user_availability(user_id uuid references auth.users on delete cascade, date date, primary key (user_id, date))`; enable RLS; add `grant all on table public.user_availability to anon, authenticated, service_role`
- [x] 2.2 Add owner policies: SELECT/INSERT/DELETE where `user_id = auth.uid()` (no friend-read policy — that is #244)
- [x] 2.3 Add SECURITY INVOKER RPC `apply_availability_diff(added date[], removed date[])` that, in one transaction, inserts `added` (`on conflict do nothing`) and deletes `removed` for `auth.uid()`; grant execute to `authenticated`. The function MUST NOT compute "now" itself — it only applies the given arrays
- [x] 2.4 Apply locally with `supabase db reset`; verify owner CRUD + the RPC (atomic add/remove), and that a second user can neither read/write the first user's rows nor affect them via the RPC — verified via psql: A's atomic add+remove works, B sees 0 of A's rows and cannot delete them

## 3. Domain + data layer (`src/features/calendar/`)

- [x] 3.1 Add a Zod model + inferred type for an availability row in `data/models/` (validate `user_id` uuid, `date` YYYY-MM-DD)
- [x] 3.2 Date cutoff: added `todayKey()` to `calendar-dates.ts` reusing the existing device-local `dayKey` as the single canonical source; DB never derives "now" (RPC/query take client values), so client/DB can't disagree. (Chose device-local over a Zurich Intl helper — observably identical for CH users, no new machinery; ceiling documented in the `todayKey` doc comment.)
- [x] 3.3 Define the repository interface in `domain/repositories/` (list own future rows from a client-supplied cutoff; apply a diff of added/removed days)
- [x] 3.4 Implement the Supabase repository in `data/repositories/` (select own rows `date >= <cutoff>` with the cutoff passed from the client; apply the diff via the `apply_availability_diff` RPC); map rows via the Zod schema

## 4. Store

- [x] 4.1 Add a Pinia availability store (`presentation/stores/`) with `loading`/`error`/`data` refs exposing the user's own available days as a Set of dayKeys; load own future availability when the Planned view mounts so the overlay renders in view mode (mirrors how tours load on calendar mount)
- [x] 4.2 Edit-session actions: `enterEdit` (reuse loaded set as baseline), `toggleDay`, `cancel`, and `save()` (diff via the RPC, post-save refetch, keep editing open on failure). Cleanup: dropped diffing to arrays (no intermediate Set), reset `error` on save, removed the leaked `getBaseline` accessor.

## 5. Edit-mode UI (`calendar-page.vue`)

- [x] 5.1 Add an extended FAB (icon + visible localized "Edit availability" text) — new `core/components/extended-fab.vue` reusing round-action-button's surface/shadow tokens; corner radius set to `--radius-md` to match the calendar surface (not a detached pill)
- [x] 5.2 Show the FAB bottom-right on the Planned view only; anchored to `.calendar-main` (which sits above the mobile bottom nav), so it clears the nav without hardcoding its height; hidden on Seasons and while editing
- [x] 5.3 In edit mode, show a bottom action bar with **Save**/**Cancel** and the friend-visibility disclaimer
- [x] 5.4 Wire Save/Cancel to the store's diff-save / discard actions; view-switch + back also discard silently

## 6. Calendar rendering (`planned-calendar.vue`)

- [x] 6.1 Render own availability as a light-green background overlay (via `--color-success` `color-mix`) on available days in BOTH view and edit mode, coexisting with tour pills, `--today`, `--muted`; desktop grid + mobile day-list
- [x] 6.2 Edit mode: overlay reflects the in-progress working set live (`displayDays`); days before today are non-selectable
- [x] 6.3 Implement pointer-based tap-toggle + drag-across-consecutive-days selection (direction fixed by the first day); pointer events → mouse + touch. Fix: release implicit pointer capture on `pointerdown` (guarded by `hasPointerCapture`) so touch swipe hit-tests each cell instead of marking only the first day

## 7. Tests

- [x] 7.1 Store unit tests (`test/features/calendar/.../availability-store.test.ts`) for edge cases: correct added/removed diff arrays, no RPC when unchanged, failed RPC keeps editing open + sets error, cancel discards. Repository mocked via `vi.hoisted` double. **3 of 4 are RED until the `save()` gap is filled** — that is their purpose.
- [x] 7.2 Component tests: `planned-calendar-availability.test.ts` (edit-mode selectable-day gating, past-day + not-editing pointerdown ignored, overlay from saved set) and `calendar-page.test.ts` (FAB → enterEdit; view-switch + back discard via cancel, not called when not editing)

## 8. i18n

- [x] 8.1 Added `calendar.availability.{edit,save,cancel,disclaimer}` to BOTH `en.json` and `de-CH.json` ("Edit availability" / "Verfügbarkeit angeben")

## 9. Finalize

- [x] 9.1 `npx eslint --fix` on changed files — clean (reordered imports only)
- [x] 9.2 `npm run type-check` passes; `npm run test` → 1096 pass, only the 3 `save()`-gap tests red
- [ ] 9.3 Prompt the user to commit with a ready-to-copy conventional commit message — do NOT run `git commit` (blocked on the `save()` gap + 7.2)
- [ ] 9.4 Prompt the user to `supabase db push` to prod (deploy step — never run unprompted) and to push the branch + open a PR to `main`
