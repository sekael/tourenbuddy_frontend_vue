## Context

Tours today are write-once. `ToursRepository` exposes only `listToursForUser` and `createTourWithPartners` (`src/features/tours/domain/repositories/tours-repository.ts`, `src/features/tours/data/repositories/tours-repository-impl.ts:6`). The info sheet (`src/features/tours/presentation/components/tour-info-sheet.vue`) is read-only. Contacts already ship an equivalent flow: `ContactsRepository.updateContact` + `deleteContact`, `useContactsStore.updateContact` + `deleteContact`, and `contact-detail-view.vue` with inline delete confirmation. Issue #66 asks us to apply the same pattern to tours.

## Goals / Non-Goals

**Goals:**

- Edit + delete entry points on the tour info sheet.
- Edit view reuses every field already supported at creation (name, date, type, elevation, GPX, description, seasons, start/end, equipment, notes, partners).
- Delete flow matches contacts: inline confirm, loading + error state, no accidental destruction.
- Repository + store parity with contacts (`updateTour`, `deleteTour`).

**Non-Goals:**

- Multi-select or bulk delete.
- Undo/restore of deleted tours.
- Route-level edit page — the sheet stays the container.
- Optimistic UI for delete (we wait for server confirm, same as contacts).
- Partial patches per field — edit save sends the full draft like create.

## Decisions

### 1. Edit UI lives inside the tour info sheet (mode switch), not a new route

The info sheet already owns the sheet/drawer shell (`<component :is="isDesktop ? SideDrawer : BottomSheet">`). Adding a local `mode: 'view' | 'edit'` ref and swapping the body preserves the current open/close animation and matches how contacts operate inside the contacts list sheet.

Alternative considered: dedicated route `/tours/:id/edit`. Rejected — the map context is the point of the sheet; navigating away loses it, and contacts deliberately avoid this.

### 2. Extract a shared `tour-form.vue` used by both create and edit

`tour-creation-dialog.vue` currently owns all field state, validation, GPX parsing, and point-picking emits. Extracting the form body into `src/features/tours/presentation/components/tour-form.vue` (props: `initialDraft`, `submitLabel`, `allowGoalEdit`; emits: `submit`, `cancel`, `pickPoint`) lets edit mode reuse it unchanged. The dialog becomes a thin wrapper; the info sheet's edit mode embeds the same component.

In create mode the parent picks the goal on the map before opening the dialog, so the form shows the goal read-only. In edit mode `allowGoalEdit` is true: the goal row becomes a tappable "Change goal" action that emits `pickPoint: 'goal'`; the value itself is never entered inline. This reuses the existing start/end pattern.

Alternative considered: duplicate the form inside `tour-info-sheet.vue`. Rejected — drift between create and edit validation is exactly the bug contacts avoided by keeping edit/create logic close.

### 3. Goal re-pick reuses the existing `LocationPicker` orchestration

Start/end picking today: `tour-creation-dialog.vue` emits `pickPoint: 'start' | 'end'`, `map-page.vue` hides the dialog, toggles `mapStore.setPickingLocation(true)`, renders `<LocationPicker>`. On confirm the page writes the coordinates into the dialog's initial props and re-opens it.

We extend that flow with a `'goal'` type. When the info-sheet edit view emits `pickPoint: 'goal'`, `map-page.vue` hides the sheet (or its edit mode), opens `LocationPicker`, and on confirm updates the pending goal for the current edit session before returning to the edit view. On cancel the original goal is preserved. The tour's current `goal` seeds the picker's starting camera position so the crosshair starts where the user would expect.

The edit session state (in-flight form values + pending new goal) lives in the info sheet / edit view for its lifetime; because `LocationPicker` is a sibling overlay and the sheet is merely hidden (not unmounted) during picking, form state survives a goal re-pick.

### 4. Backend: new RPC `update_tour_full`, plus a DELETE via Supabase

Create uses `supabase.rpc('create_tour_full', …)` to insert the tour plus partner rows atomically. Update needs the same guarantee (replace `tour_partners` set, rewrite PostGIS points). We add a sibling RPC `update_tour_full(p_id, …same payload…)` that UPDATEs `tours` and replaces `tour_partners` in one transaction. Delete is a plain `supabase.from('tours').delete().eq('id', id)`; RLS scopes it to the owner and the `tour_partners` FK cascades.

Alternative considered: PATCH-style partial updates. Rejected — the form always submits a full draft, partial-patch semantics add complexity without UX benefit.

### 5. Store actions mutate local list in place (no full reload)

`createTourFromDraft` today calls `loadTours()` after insert. For update/delete we mirror `useContactsStore`: splice the updated tour into `tours.value` / filter it out on delete. Saves one network round-trip and keeps the map markers stable.

### 6. Delete confirmation is inline, not a modal

Matches contacts (`contact-detail-view.vue:347-376`). Two states inside the danger section: `idle` (red "Delete tour" button) and `confirm` (text + Cancel/Delete). Loading disables the button; errors render inline.

## Risks / Trade-offs

- **Risk**: `update_tour_full` RPC does not yet exist in Supabase → the client-side change ships but editing fails. **Mitigation**: task list includes creating the RPC migration; do not merge the frontend until the migration is deployed.
- **Risk**: Deleting a tour referenced elsewhere (future features like activity logs) could orphan data. **Mitigation**: rely on FK cascade / RLS at the DB layer; current schema only links `tour_partners`, which already cascades.
- **Trade-off**: Full-draft update means editing one field still sends the whole payload. Acceptable given form size and Supabase latency on the free tier — simpler than per-field diffing.
- **Risk**: Shared `tour-form.vue` extraction touches `tour-creation-dialog.vue`, which is stable. **Mitigation**: keep the dialog's external props/emits identical; refactor is mechanical.
- **Risk**: Mode switch inside the sheet means a user with unsaved edits who taps the map could lose changes. **Mitigation**: match contacts — discard on back/close, no warning prompt (documented in spec).
