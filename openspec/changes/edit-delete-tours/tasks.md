## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/edit-delete-tours`

## 2. Supabase Migration

- [x] 2.1 Add SQL migration creating `update_tour_full(p_id, p_planned_date, p_name, p_goal, p_partner_ids, p_tour_type, p_elevation, p_gpx_track, p_description, p_seasons, p_start_point, p_end_point, p_equipment, p_notes)` RPC — UPDATE `tours` + DELETE/INSERT `tour_partners` in one transaction, RLS-scoped to `auth.uid()`
- [x] 2.2 Verify existing FK `tour_partners.tour_id → tours.id` has `ON DELETE CASCADE`; add migration if missing
- [ ] 2.3 Apply migration to the dev Supabase project and smoke-test both operations via SQL editor

## 3. Domain & Data Layer

- [x] 3.1 Extend `ToursRepository` (`src/features/tours/domain/repositories/tours-repository.ts`) with `updateTour(id, draft, goal)` and `deleteTour(id)` signatures
- [x] 3.2 Implement `updateTour` in `src/features/tours/data/repositories/tours-repository-impl.ts` using `supabase.rpc('update_tour_full', …)` mirroring `createTourWithPartners`
- [x] 3.3 Implement `deleteTour` in the same file using `supabase.from('tours').delete().eq('id', id)` and throw on error

## 4. Store Layer

- [x] 4.1 Add `updateTour(id, draft, goal)` action to `useToursStore` (`src/features/tours/presentation/stores/tours-store.ts`) that calls the repo then replaces the matching entry in `tours.value` in place
- [x] 4.2 Add `deleteTour(id)` action that calls the repo then filters the tour out of `tours.value`
- [x] 4.3 Ensure both actions re-throw repository errors so callers can display them; export from the store

## 5. Shared Tour Form

- [x] 5.1 Create `src/features/tours/presentation/components/tour-form.vue` with all fields, validation, GPX parsing, and partner selection from the current creation dialog
- [x] 5.2 Define props `{ initialDraft?: TourDraft | null, submitLabel: string, allowGoalEdit?: boolean }` and emits `{ submit: [TourDraft], cancel: [], pickPoint: ['start' | 'end' | 'goal'] }`; goal row is read-only when `allowGoalEdit` is false, becomes a "Change goal" action emitting `pickPoint: 'goal'` when true
- [x] 5.3 Refactor `tour-creation-dialog.vue` to render `TourForm` — preserve existing external props/emits and point-picking behavior
- [x] 5.4 Add/adjust component test covering pre-filled edit mode (all fields hydrated from `initialDraft`)

## 6. Tour Info Sheet UI

- [x] 6.1 Add local `mode: 'view' | 'edit'` state to `tour-info-sheet.vue`; render `TourForm` when `mode === 'edit'`
- [x] 6.2 Add edit action (Material Symbols `edit`) in the sheet header that switches to edit mode
- [x] 6.3 Track a `pendingGoal` ref in the sheet seeded from the tour's current goal so form state survives goal re-picks
- [x] 6.4 Propagate `TourForm` `pickPoint: 'goal'` up to `map-page.vue`; extend `pendingPickType` to accept `'goal'`, hide the sheet while picking, open `LocationPicker` centered on `pendingGoal`, and on confirm update `pendingGoal` and restore the sheet in edit mode; on cancel restore without mutation
- [x] 6.5 Wire `TourForm` submit to `toursStore.updateTour(tour.id, draft, pendingGoal.value)`; display inline error and remain in edit mode on failure; return to view mode on success
- [x] 6.6 Wire `TourForm` cancel/back to return to view mode discarding edits (including any pending new goal)
- [x] 6.7 Add inline delete section (red "Delete tour" button → Cancel/Delete confirm → loading state → inline error), mirroring `contact-detail-view.vue`
- [x] 6.8 On successful delete, emit `close` so the parent removes the sheet and the marker

## 7. Tests

- [x] 7.1 Unit test `useToursStore.updateTour` — success replaces entry, error leaves list unchanged
- [x] 7.2 Unit test `useToursStore.deleteTour` — success removes entry, error leaves list unchanged
- [x] 7.3 Component test for tour info sheet edit mode (enter, name-required validation, save success, save error)
- [x] 7.4 Component test for goal re-pick flow (pickPoint emitted, sheet hidden during pick, new goal reflected on confirm, original goal preserved on cancel, other form values preserved)
- [x] 7.5 Component test for tour info sheet delete flow (confirm, cancel, loading, error)

## 8. Finalize

- [x] 8.1 `npm run lint` and `npm run format` — zero warnings
- [x] 8.2 `npm run type-check` and `npm run test` — all green
- [x] 8.3 Prompt user to commit with message: `feat(tours): add edit and delete tour from info sheet`
- [x] 8.4 Prompt user to push branch and open PR against `main` referencing issue #66
