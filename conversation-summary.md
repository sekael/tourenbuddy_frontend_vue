 Summary:
     1. Primary Request and Intent:
        The session continued from a previous conversation implementing edit/delete tour functionality (GitHub issue #66 from sekael/tourenbuddy_frontend_flutter). The user reported multiple bugs requiring fixes:
        - Bug 1: Goal pick in edit mode "exits edit mode" and coordinates don't update; edit/delete buttons should be at the BOTTOM of the info sheet, not top
        - Bug 2: Changes to tours (after saving edits) only show after closing and reopening the info sheet — not immediately
        - Bug 3 (most recent): When editing a tour and changing the goal, (a) hitting "Continue" on the LocationPicker has no effect, (b) hitting "Cancel" must return to edit view (currently it doesn't), (c) hitting "Continue" must update coordinates AND fetch automated name/elevation from Swisstopo

     2. Key Technical Concepts:
        - Vue 3 `<script setup lang="ts">` SFCs with TypeScript
        - Pinia composition API stores (`defineStore` setup syntax)
        - `computed` vs `ref` for reactive derived state — critical for ensuring store mutations propagate to components
        - Prop-based reactive handoff pattern (replaces fragile `defineExpose` + template ref approach)
        - Vue `watch(() => props.X, callback)` for reacting to prop changes
        - MapLibre GL JS pointer-events behavior: `pointer-events: none` overlay allows touch/click events to pass through to map canvas
        - Swisstopo elevation + name lookups (`getElevation`, `suggestTourName`) — run in parallel via `Promise.all`
        - ESLint `style/member-delimiter-style` vs Prettier conflict — fix by running `npm run format` then `npx eslint --fix src/ test/`
        - `PickPointType = 'goal' | 'start' | 'end'` orchestration across map-page, TourInfoSheet, TourForm

     3. Files and Code Sections:
        - **`src/features/map/presentation/pages/map-page.vue`**
          - Most heavily modified file across multiple bug fixes
          - Bug 1 fix: Removed `tourInfoSheetRef = ref<InstanceType<typeof TourInfoSheet> | null>(null)`, added `editPickedPoint` ref and `handlePointConsumed` function
          - Bug 2 fix: Changed `selectedTour` from `ref` (only updated on `selectedTourId` change) to `computed` (derives from `tours` + `selectedTourId` reactively)
          - Bug 3 fix: Added guard in `handleMapBackgroundClick` to return early when picking; added Swisstopo lookups for edit goal picks
          - Key final state of critical sections:
          ```javascript
          // selectedTour as computed — auto-updates when tours store mutates
          const selectedTour = computed(
            () => tours.value.find(t => t.id === selectedTourId.value) ?? null,
          )

          // editPickedPoint with elevation/name for goal picks
          const editPickedPoint = ref<{
            type: 'start' | 'end' | 'goal'
            location: { lng: number, lat: number }
            elevation?: number | null
            suggestedName?: string | null
          } | null>(null)

          // Guard map background click during location pick
          function handleMapBackgroundClick() {
            if (isPickingLocation.value)
              return
            mapStore.selectTour(null)
            showFeedbackSheet.value = false
            showProfileSheet.value = false
            showContactDialog.value = false
          }

          // handleLocationConfirmed — edit goal pick with Swisstopo
          async function handleLocationConfirmed(location) {
            mapStore.setPickingLocation(false)
            if (isPickingForEdit.value) {
              const pickType = pendingPickType.value as PickPointType
              isPickingForEdit.value = false
              pendingPickType.value = 'goal'
              if (pickType === 'goal') {
                const [elevation, suggestedName] = await Promise.all([
                  getElevation(location),
                  suggestTourName(location),
                ])
                editPickedPoint.value = { type: 'goal', location, elevation, suggestedName }
              } else {
                editPickedPoint.value = { type: pickType, location }
              }
              return
            }
            // ... creation flow unchanged
          }

          function handlePointConsumed() {
            editPickedPoint.value = null
          }
          ```
          - TourInfoSheet in template:
          ```vue
          <TourInfoSheet
            :tour="selectedTour"
            :edit-picked-point="editPickedPoint"
            @close="closeTourInfo"
            @pick-point="(t: 'start' | 'end' | 'goal') => handleInfoSheetPickPoint(t)"
            @point-consumed="handlePointConsumed"
          />
          ```

        - **`src/features/tours/presentation/components/tour-info-sheet.vue`**
          - Bug 1 fix: Replaced `defineExpose({ applyPointPick })` with prop-based watch pattern; moved action buttons to bottom
          - Bug 3 fix: Added `pendingElevation`/`pendingSuggestedName` refs, extended watch to apply them, pass to TourForm
          - Key prop definition:
          ```typescript
          const props = defineProps<{
            tour: Tour
            editPickedPoint?: {
              type: 'start' | 'end' | 'goal'
              location: { lng: number, lat: number }
              elevation?: number | null
              suggestedName?: string | null
            } | null
          }>()
          const emit = defineEmits<{
            close: []
            pickPoint: [type: 'start' | 'end' | 'goal']
            pointConsumed: []
          }>()
          ```
          - Pending refs and watch:
          ```javascript
          const pendingGoal = ref<{ lng: number, lat: number }>({ ...props.tour.goal })
          const pendingStartPoint = ref<{ lng: number, lat: number } | null>(null)
          const pendingEndPoint = ref<{ lng: number, lat: number } | null>(null)
          const pendingElevation = ref<number | null>(null)
          const pendingSuggestedName = ref<string | null>(null)

          function enterEditMode() {
            pendingGoal.value = { ...props.tour.goal }
            pendingStartPoint.value = null
            pendingEndPoint.value = null
            pendingElevation.value = null
            pendingSuggestedName.value = null
            mode.value = 'edit'
          }

          watch(
            () => props.editPickedPoint,
            (pick) => {
              if (!pick) return
              if (pick.type === 'goal') {
                pendingGoal.value = pick.location
                pendingElevation.value = pick.elevation ?? null
                pendingSuggestedName.value = pick.suggestedName ?? null
              } else if (pick.type === 'start') {
                pendingStartPoint.value = pick.location
              } else {
                pendingEndPoint.value = pick.location
              }
              emit('pointConsumed')
            },
          )
          ```
          - TourForm usage with new props:
          ```vue
          <TourForm
            submit-label="Save"
            :allow-goal-edit="true"
            :current-goal="pendingGoal"
            :initial-draft="tour"
            :initial-elevation="pendingElevation"
            :initial-name="pendingSuggestedName"
            :initial-start-point="pendingStartPoint"
            :initial-end-point="pendingEndPoint"
            @submit="handleEditSubmit"
            @cancel="cancelEdit"
            @pick-point="emit('pickPoint', $event)"
          />
          ```
          - View mode action buttons moved to BOTTOM (after all detail rows: tour type, date, coordinates, elevation, start/end, seasons, description, equipment, notes, GPX, partners)

        - **`src/features/tours/presentation/components/tour-form.vue`**
          - Not modified in this session, but important context: it already has `watch(() => props.initialElevation, ...)` and `watch(() => props.initialName, ...)` that update internal `elevation` and `tourName` refs when props change. This is what enables the auto-fill behavior.
          - Props: `submitLabel`, `allowGoalEdit`, `currentGoal`, `initialDraft`, `initialElevation`, `initialName`, `initialStartPoint`, `initialEndPoint`
          - Emits: `submit: [TourDraft]`, `cancel: []`, `pickPoint: [type]`

        - **`test/features/tours/presentation/components/tour-info-sheet.test.ts`**
          - Tests use stub for TourForm, BottomSheet, SideDrawer, ContactChip
          - All 8 tests pass (edit mode: show form, cancel, save success, save error; delete flow: confirm, cancel, confirm success, confirm error)
          - No tests reference `applyPointPick` or `defineExpose` (not needed after prop-based approach)

        - **`src/features/map/presentation/components/location-picker.vue`**
          - z-index: 200 (above info sheet at z-index 50)
          - `pointer-events: none` on main container, `pointer-events: all` on `.actions` div
          - This is the root cause of the pass-through click bug: map panning taps pass through the overlay to MapLibre canvas

     4. Errors and fixes:
        - **`watch is not defined` in tour-info-sheet.vue**: Added `watch` to Vue import: `import { computed, ref, watch } from 'vue'`
        - **`style/member-delimiter-style` lint errors**: Prettier uses semicolons in TS inline object types, ESLint wants commas. Fix: run `npm run format` then `npx eslint --fix src/ test/` sequentially. CI only runs `npm run lint`, so this sequence must be the last step before committing.
        - **Pre-existing lint errors across entire branch**: Running `npx eslint --fix src/ test/` auto-fixed 250+ errors across all modified files. The conflict is specific to `@antfu/eslint-config v4.19.0` with `formatters: true` conflicting with standalone Prettier.
        - **`TourInfoSheet` unused import**: After removing `tourInfoSheetRef` (of type `InstanceType<typeof TourInfoSheet>`), the import stays because TourInfoSheet is still used in the template.

     5. Problem Solving:
        - **Prop-based handoff vs defineExpose**: Replaced `defineExpose({ applyPointPick })` + template ref (`tourInfoSheetRef`) with a reactive prop `editPickedPoint` + `pointConsumed` emit. This is more robust because it uses Vue's reactivity system rather than imperative method calls that can fail silently if the ref is null.
        - **selectedTour as computed**: The key insight was that `ref` only updates when explicitly assigned (in the `watch(selectedTourId)` handler), while `computed` reacts automatically to any change in its dependencies (`tours.value` or `selectedTourId.value`). After `updateTour` replaces the tour in `tours.value`, the `computed` immediately reflects the
     new tour.
        - **Map background click race condition**: The pointer-events: none overlay means MapLibre receives touch events during map panning in the location picker. Solution: suppress `handleMapBackgroundClick` entirely when `isPickingLocation.value` is true. This protects both the edit-mode goal pick flow AND the creation-mode start/end point pick flow.
        - **Swisstopo lookups for goal re-pick**: In creation mode, `getElevation` + `suggestTourName` run in `handleLocationConfirmed` before showing the dialog. In edit mode, the same lookups now run for 'goal' type picks and are included in the `editPickedPoint` payload. TourInfoSheet's watch applies them to `pendingElevation`/`pendingSuggestedName`, which
     flow into TourForm via `:initial-elevation` / `:initial-name` props.

     6. All user messages:
        - (Continuation from previous context — session started with system-reminders showing pre-loaded file reads)
        - "Picking new location and hitting Confirm does not update tour goal, just exits edit mode. Display edit and delete buttons at bottom of tour info sheet."
        - "Need to fix bugs. Changes to tours do not take effect immediately, are only displayed after closing and reopening tour info sheet. Changes during edit must be shown immediately."
        - "When edit tour and change goal, location picker opens, but hitting continue on new location has no effect. Pressing cancel in location picker for changing goal must return to edit view of tour. Hitting continue must return to edit view and update coordinates and automated name and elevation in edit view."
        - "CRITICAL: Respond with TEXT ONLY..." (current summary request)

     7. Pending Tasks:
        - **Task 2.3**: Apply `supabase/migrations/20260415_tour_update_delete.sql` to dev Supabase project and smoke-test (user must do manually)
        - **Task 8.3**: User commits with message: `feat(tours): add edit and delete tour from info sheet`
        - **Task 8.4**: Push branch `feat/edit-delete-tours` and open PR against `main` referencing issue #66 from sekael/tourenbuddy_frontend_flutter

     8. Current Work:
        Immediately before this summary, three bugs were fixed in the goal-pick flow for edit mode:

        **Fix 1** (`map-page.vue` — `handleMapBackgroundClick`):
        ```javascript
        function handleMapBackgroundClick() {
          if (isPickingLocation.value)
            return
          mapStore.selectTour(null)
          showFeedbackSheet.value = false
          showProfileSheet.value = false
          showContactDialog.value = false
        }
        ```

        **Fix 2** (`map-page.vue` — `handleLocationConfirmed` for edit goal pick):
        ```javascript
        if (isPickingForEdit.value) {
          const pickType = pendingPickType.value as PickPointType
          isPickingForEdit.value = false
          pendingPickType.value = 'goal'
          if (pickType === 'goal') {
            const [elevation, suggestedName] = await Promise.all([
              getElevation(location),
              suggestTourName(location),
            ])
            editPickedPoint.value = { type: 'goal', location, elevation, suggestedName }
          } else {
            editPickedPoint.value = { type: pickType, location }
          }
          return
        }
        ```

        **Fix 3** (`tour-info-sheet.vue` — watch + TourForm props):
        - Added `pendingElevation`/`pendingSuggestedName` refs
        - Watch applies them when type is 'goal'
        - Passes `:initial-elevation="pendingElevation"` and `:initial-name="pendingSuggestedName"` to TourForm

        Final state: 190 tests passing, zero lint errors, type-check clean.

     9. Optional Next Step:
        The user's most recent bug fixes are complete. The remaining pending tasks are administrative:

        From tasks.md:
        - Task 8.3: "Prompt user to commit with message: `feat(tours): add edit and delete tour from info sheet`"
        - Task 8.4: "Prompt user to push branch and open PR against `main` referencing issue #66"

        The next step is to prompt the user to commit and push, providing the ready-to-copy commit message `feat(tours): add edit and delete tour from info sheet` and instructions to push the `feat/edit-delete-tours` branch and open a PR against `main` referencing sekael/tourenbuddy_frontend_flutter#66.
