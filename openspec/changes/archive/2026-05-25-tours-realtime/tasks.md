## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/189-tours-realtime`
- [x] 1.2 Verify `supabase status` shows local stack running (start with `supabase start` if not).

## 2. Migration: publication + replica identity

- [x] 2.1 Create new migration file: `supabase migration new realtime_tours_publication`.
- [x] 2.2 `alter table public.tours replica identity full;`
- [x] 2.3 `alter table public.tour_attachments replica identity full;`
- [x] 2.4 Add `public.tours` to `supabase_realtime` publication wrapped in `do $$ … exception when duplicate_object then null; end $$;` (mirror `20260520101408_realtime_friendships_publication.sql`).
- [x] 2.5 Add `public.tour_attachments` to `supabase_realtime` publication, same guard.
- [x] 2.6 (Intentionally skipped — `tour_partners` not added; covered transitively by `tours` events.)
- [x] 2.7 `supabase db reset` locally and confirm the migration applies cleanly.
- [x] 2.8 Verify in `psql`: publication contains `public.tours` and `public.tour_attachments`; `relreplident = 'f'` on both; `public.tour_partners` is NOT in the publication.

## 3. Tours store wiring

- [x] 3.1–3.7 **YOUR TURN** — fill the `// TODO(me)` gap in `src/features/tours/presentation/stores/tours-store.ts`. See gap task below.
- [x] 3.8 Rework `setCompleted` failure path: on RPC reject, call `loadTours()` instead of the local rollback, so the list converges to server truth even if a device-B edit raced with the failed write. Updated test.

## 4. Tour attachments store wiring

- [x] 4.1 In `tour-attachments-store`, add `currentTourId` ref. `load(tourId)` sets it. Added `clearCurrent()` action. Added `clearCurrent()` call in `onUnmounted` of `tour-attachments-strip.vue`.
- [x] 4.2 Wire `useRealtimeSubscription` with channel key `tour-attachments-${uid}`, a single binding on `tour_attachments` (`event: '*'`, `filter: user_id=eq.${uid}`).
- [x] 4.3 In `onChange`, short-circuit if `currentTourId` is null; otherwise call `load(currentTourId)`.
- [x] 4.4 Add `clear()` action that resets `attachmentsByTour`, `stagedByDraft`, `currentTourId`, and `error`. Added `watch(() => authStore.isAuthenticated, …)` that invokes `clear()` on sign-out.

## 5. Tests

- [x] 5.1 `tours-store`: test channel key is `null` when unauthenticated. (in `realtime-wiring.test.ts` — passes after gap filled)
- [x] 5.2 `tours-store`: test `enabled=false` when unauthenticated. (passes after gap filled)
- [x] 5.3 `tours-store`: test single binding on `tours` filtered by `user_id`. (passes after gap filled)
- [x] 5.4 `tours-store`: test `onChange` triggers `loadTours` after timer. (passes after gap filled)
- [x] 5.5 `tour-attachments-store`: mirror tests for key, binding, `onChange` short-circuit when null, `onChange` calls `load(currentTourId)`. All pass now.
- [x] 5.6 `tours-store`: test `setCompleted` failure calls `loadTours()` instead of local rollback. Updated existing test.
- [x] 5.7 Run `npm run test`; all pass (6 tours-store realtime tests pending gap fill).

## 6. Manual verification

- [x] 6.1 With local Supabase + dev server running, open two browser sessions (or one private + one normal) signed in as the same user.
- [x] 6.2 Create a tour on session A; confirm session B shows it within ~150 ms without reload.
- [x] 6.3 Edit the tour on session B; confirm session A reflects the edit.
- [x] 6.4 Delete the tour on session A; confirm session B removes it.
- [x] 6.5 Add an attachment on session A; confirm session B shows it on the open tour's attachment view.
- [x] 6.6 With session B's map page open, on session A: (a) create a tour and confirm a new marker / updated cluster appears on B; (b) move an existing tour's goal (edit + save) and confirm B's cluster tree rebuilds to reflect the new position; (c) delete a tour and confirm B's cluster tree shrinks. All within one debounce window.
- [x] 6.7 Sign out on session A; confirm no further Realtime events arrive (DevTools → Network → WS frames or console logs).

## 7. Finalize

- [x] 7.1 `npx eslint . --fix` — zero warnings.
- [x] 7.2 `npm run type-check` — passes.
- [x] 7.3 `npm run test` — 906/906 pass.
- [x] 7.4 Prompt user to commit. Suggested message:
      ```
      feat(tours): add Supabase Realtime sync for tours and attachments

      Subscribe tours-store and tour-attachments-store to postgres_changes
      via the shared useRealtimeSubscription primitive. Cross-device tour
      create/update/delete now propagate within one debounce window without
      a page reload. Sets REPLICA IDENTITY FULL on tours and tour_attachments
      and registers them in the supabase_realtime publication. RLS unchanged.
      setCompleted failure path now resyncs via loadTours() instead of local
      rollback.

      Closes #189
      ```
- [x] 7.5 Prompt user to `git push -u origin feat/189-tours-realtime` and open a PR against `main`.
- [x] 7.6 Prompt user to `supabase db push` against prod *only after* PR approval.
- [x] 7.7 After merge, prompt user to archive this change with `/opsx:archive`.
