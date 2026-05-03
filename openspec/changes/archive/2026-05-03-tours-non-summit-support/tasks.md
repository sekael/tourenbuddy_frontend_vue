## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/92-tours-non-summit-support`

## 2. Database / Backend Coordination

- [x] 2.1 Coordinate / verify Supabase migration adds columns `start_point_name` (text), `start_point_elevation` (integer), `end_point_name` (text), `end_point_elevation` (integer) on `tours` (all nullable)
- [x] 2.2 Update `tours_view` to expose the four new columns
- [x] 2.3 Update `create_tour_full` and `update_tour_full` RPCs to accept `p_start_point_name`, `p_start_point_elevation`, `p_end_point_name`, `p_end_point_elevation`

## 3. Domain & Data Layer

- [x] 3.1 Extend Zod schema in `src/features/tours/data/models/tour-schema.ts` with the four new fields (nullable)
- [x] 3.2 Update `Tour` entity in `src/features/tours/domain/entities/tour.ts`
- [x] 3.3 Update `TourDraft` to carry start/end name + elevation
- [x] 3.4 Update `tours-repository-impl.ts` to map new columns from `tours_view` and pass new RPC params on create + update
- [x] 3.5 Update `tours-store.ts` action signatures to thread new fields through

## 4. Pick-Type Label in Collapsed Overlay Header

- [x] 4.1 Expose `pendingPickType` from `map-page.vue` to both `tour-creation-dialog.vue` and `tour-info-sheet.vue` as a prop (e.g., `activePickType: 'goal' | 'start' | 'end' | null`)
- [x] 4.2 In `tour-creation-dialog.vue`, replace the `pickingTitle` computed: when `isPicking`, return the localized label for `activePickType` (`tours.picker.goalTitle` | `startTitle` | `endTitle`) instead of interpolating the tour name
- [x] 4.3 Mirror the same logic in `tour-info-sheet.vue` `sheetTitle` computed for edit-mode picks
- [x] 4.4 Verify `BottomSheet` collapsed header (mobile) and `SideDrawer` collapsed compact header (desktop) both render the new label correctly via the existing `:collapsed` mechanism — no changes to those components expected
- [x] 4.5 Confirm `location-picker.vue` is NOT modified to add an in-canvas title bar
- [x] 4.6 Add i18n keys to `src/locales/en.json` and `src/locales/de-CH.json`: - `tours.picker.goalTitle` ("Tour Goal" / "Tourenziel") - `tours.picker.startTitle` ("Start Point" / "Startpunkt") - `tours.picker.endTitle` ("End Point" / "Endpunkt")

## 5. Map Page — Start/End Metadata Fetch

- [x] 5.1 In `handleLocationConfirmed` for `start` pick, call `Promise.all([getElevation, suggestTourName])` and store result on a new ref `dialogInitialStartPointMeta`
- [x] 5.2 Same for `end` pick → `dialogInitialEndPointMeta`
- [x] 5.3 Pass new metadata refs as props to `tour-creation-dialog` → `tour-form`
- [x] 5.4 Reset metadata refs in `closeOverlay` / dialog close handler

## 6. Tour Form

- [x] 6.1 Remove `effectiveStartPoint` and `effectiveEndPoint` computeds from `tour-form.vue`
- [x] 6.2 Persist `startPoint` / `endPoint` exactly as picked in the emitted draft (no fallback)
- [x] 6.3 Add reactive metadata state `startPointName`, `startPointElevation`, `endPointName`, `endPointElevation`; initialize from `props.initialDraft` and `initialStartPointMeta` / `initialEndPointMeta`
- [x] 6.4 Conditionally render end-point row: when `endPoint === null`, show an "Add end point" button instead
- [x] 6.5 Clearing the end point (existing X button) also clears `endPointName` and `endPointElevation`
- [x] 6.6 Render name + elevation on start-point row when present
- [x] 6.7 Render name + elevation on end-point row when present
- [x] 6.8 Allow user to edit auto-filled start/end name (consistency with goal name field)
- [x] 6.9 Add i18n keys: `tours.form.addEndPointBtn` (en: "Add end point", de-CH: "Endpunkt hinzufügen")

## 7. Tour Info Sheet

- [x] 7.1 Update `tour-info-sheet.vue` start-point row to show `startPointName` / `startPointElevation` when present
- [x] 7.2 Same for end-point row with `endPointName` / `endPointElevation`
- [x] 7.3 Replace "Round trip" indicator with "One-way to goal" when start is set and end is null
- [x] 7.4 Add/adjust i18n keys for the indicator (`tours.infoSheet.oneWayToGoalIndicator`)

## 8. Tests

- [x] 8.1 Unit test Zod schema parses new nullable fields and legacy rows (null) correctly
- [x] 8.2 Repository test: create + update pass new RPC params; null fields stay null
- [x] 8.3 Component test `tour-form`: end-point row hidden by default; revealed by "Add end point"
- [x] 8.4 Component test `tour-form`: clearing end point clears its metadata
- [x] 8.5 Component test `tour-creation-dialog` / `tour-info-sheet`: collapsed header title resolves to the correct label per `activePickType` (goal/start/end) on mobile and desktop layouts
- [x] 8.6 Component test `tour-info-sheet`: name + elevation render for start/end when present; "One-way to goal" indicator shows for start-only tours

## 9. Finalize

- [x] 9.1 Run `npx eslint . --fix` and `npm run format`
- [x] 9.2 Run `npm run type-check` and `npm run test` — all must pass
- [x] 9.3 Manually verify in dev: pick goal (title bar), pick start (auto-fill), add end point, remove end point, save, reopen info sheet
- [x] 9.4 Prompt user to commit with conventional message:
      `feat(tours): support non-summit tours with optional end point and start/end metadata (#92)`
- [x] 9.5 Prompt user to push and open PR linking issue #92
