## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/169-always-visible-tour-actions`

## 2. i18n keys

- [x] 2.1 Add `map.actionBar.myTours` ("My Tours" / "Meine Touren") to `en.json` and `de-CH.json`
- [x] 2.2 Add `map.actionBar.addTourAriaLabel` (reuse the existing add-tour wording, e.g. "Add tour" / "Tour hinzufügen") for the icon-only segment
- [x] 2.3 Add `tours.list.addTourAriaLabel` for the icon-only Add-tour button in the tour list sheet header
- [x] 2.4 Verify `map.overlay.addTourTooltip` and `map.overlay.signInToAddToursTooltip` already exist; reuse for the Add-tour segment tooltip

## 3. TourActionBar component

- [x] 3.1 Create `src/features/map/presentation/components/tour-action-bar.vue`
- [x] 3.2 Define props `{ visible: boolean; toursDisabled: boolean; addTourDisabled: boolean; addTourTooltip?: string }` and emits `{ tours: []; addTour: [] }`
- [x] 3.3 Render as a single rounded pill (52px tall, 26px border-radius) with two segments separated by a 1px `--color-outline-variant` divider: My Tours (icon `location_on` + label) and icon-only Add-tour (`add_location_alt`, `aria-label` from `map.actionBar.addTourAriaLabel`)
- [x] 3.4 Use glassmorphism tokens (`--color-fab-surface` semi-transparent, backdrop blur, `--shadow-md`); position absolutely bottom-center with `env(safe-area-inset-bottom)` padding; same layout for mobile + desktop
- [x] 3.5 Wrap the Add-tour segment in `BaseTooltip` (text from the `addTourTooltip` prop); My Tours segment shows its label inline so no tooltip needed
- [x] 3.6 When `visible === false` the component returns no markup (use `v-if`)
- [x] 3.7 Wrap the pill in `<Transition name="pill">` with 150ms `transform: translateY(8px); opacity: 0` ↔ identity, applied identically on mobile + desktop

## 4. Wire into map-page.vue

- [x] 4.1 Import and mount `TourActionBar` inside `map-page.vue` next to `MapActionOverlay`
- [x] 4.2 Add a `computed` `isToursOpen` (`activeOverlay === 'tours'`), `isTourInfoOpen` (`selectedTour && activeOverlay === 'tour'`), `isTourCreationOpen` (`activeOverlay === 'tour-creation' || showTourCreationDialog.value`)
- [x] 4.3 Add `computed` `tourActionBarVisible = !isPickingLocation.value && !isToursOpen.value && !isTourInfoOpen.value && !isTourCreationOpen.value`
- [x] 4.4 Add `computed` `tourActionBarDisabled = activeOverlay.value !== null || speedDialOpen.value` (overlays + open speed-dial menu / base-map panel); compute the add-tour disabled state additionally from `!isAuthenticated`. Expose `speedDialOpen` from `MapActionOverlay` via `defineExpose` or via a `v-model:open` two-way binding so `map-page.vue` can read it.
- [x] 4.5 Bind `@tours` and `@add-tour` to handlers that first check `activeOverlay.value !== null || speedDialOpen.value` — if so, dismiss (close overlay AND/OR close speed-dial menu) and return early; otherwise `openOverlay('tours')` or `mapStore.selectTour(null) + mapStore.setPickingLocation(true)` respectively
- [x] 4.6 Apply the same dismiss-first guard to the speed-dial trigger via `MapActionOverlay`
- [x] 4.7 Pass the appropriate tooltip (`addTourTooltip` or `signInToAddToursTooltip`) to the bar
- [x] 4.8 Derive `addTourDisabled` and the list-sheet `addTourDisabled` prop from `storeToRefs(useAuthStore()).isAuthenticated` so sign-out reactively disables both Add-tour affordances and swaps the tooltip
- [x] 4.9 Style: pill `z-index: 20`, `pointer-events: auto` at all times

## 5. Remove tours / add-tour from speed dial

- [x] 5.1 In `use-map-overlay.ts`, drop the `tours` and `add-tour` entries from `menuItems`
- [x] 5.2 Remove the `'tours'` and `'add-tour'` branches from `onMenuSelect`
- [x] 5.3 Drop the `openTours` emit (or keep emit typed but unused — prefer removal); update consumers in `map-action-overlay.vue` accordingly
- [x] 5.4 Update `map-page.vue` to stop binding `@open-tours` on `MapActionOverlay`

## 6. Disable speed dial while any overlay is open

- [x] 6.1 Pass a new prop `overlay-active: boolean` from `map-page.vue` into `MapActionOverlay` (derived from `activeOverlay.value !== null`)
- [x] 6.2 In `MapActionOverlay`, forward the flag to `SpeedDialTrigger` as a `disabled` prop; while disabled, tapping the trigger emits a new `dismiss-overlay` event (handled by `map-page.vue` → `closeOverlay()`) instead of opening the menu; render with reduced opacity / `aria-disabled="true"`
- [x] 6.3 Confirm `MapActionOverlay` still hides itself entirely while `isPickingLocation === true` (existing behaviour)

## 7. Add-tour button inside TourListSheet

- [x] 7.1 In `tour-list-sheet.vue` add an icon-only Add-tour button in the sheet header adjacent to the close button (Material Symbols `add_location_alt`, `aria-label` from `tours.list.addTourAriaLabel`)
- [x] 7.2 Disable the button when not authenticated (mirror tooltip)
- [x] 7.3 Emit a new `add-tour` event on click; do not mutate stores in the component
- [x] 7.4 In `map-page.vue`, on `@add-tour` from `TourListSheet`, call `closeOverlay()` then `mapStore.setPickingLocation(true)`

## 8. Tests

- [x] 8.1 Extract a pure helper `computeBarState({ activeOverlay, isPickingLocation, speedDialOpen, isAuthenticated })` returning `{ visible, toursAction: 'open' | 'dismiss' | 'hidden', addTourAction: 'pick' | 'dismiss' | 'disabled' | 'hidden' }` in `src/features/map/presentation/composables/compute-bar-state.ts`. Page uses it to derive the props it passes to `TourActionBar`.
- [x] 8.2 Add `test/features/map/presentation/composables/compute-bar-state.test.ts` — table-driven coverage of the matrix: pickingLocation, each tour-overlay state (tours/tour/tour-creation), each non-tour overlay, speed-dial open, unauthenticated. Assert visible + action triples.
- [x] 8.3 Add `test/features/map/presentation/components/tour-action-bar.test.ts` — covers: not rendered when `visible` is false; emits `tours` and `add-tour` in enabled state; disabled state still emits (page handles dismiss-first); aria-label / tooltip props applied correctly
- [x] 8.4 Update `test/features/map/presentation/composables/use-map-overlay.test.ts` (if present) to assert `menuItems` no longer contains `tours`/`add-tour`; otherwise add a new test file
- [x] 8.5 Update `test/features/tours/presentation/components/tour-list-sheet.test.ts` — assert the header Add-tour icon is rendered, disabled when unauthenticated, and emits `add-tour` on click
- [x] 8.6 Update any failing existing tests that asserted Tours/Add-tour entries in the speed-dial menu

## 9. Manual verification

- [ ] 9.1 `npm run dev` — verify on a mobile viewport (≤599px): bar bottom-center, two buttons, Add tour triggers pick → creation dialog flow
- [ ] 9.2 Verify on a desktop viewport (≥600px): bar bottom-center, Tours opens side drawer, bar hides while drawer open; add-tour button appears at top of the list and starts creation flow
- [ ] 9.3 Open feedback / profile / contacts — confirm bar remains visible but buttons disabled, speed-dial trigger disabled
- [ ] 9.4 Pick a goal location — confirm bar hidden while picker active, restored on cancel
- [ ] 9.5 Confirm speed-dial menu no longer lists Tours / Add tour entries

## 10. Finalize

- [x] 10.1 Run `npx eslint . --fix` (zero warnings)
- [x] 10.2 Run `npm run type-check`
- [x] 10.3 Run `npm run test`
- [ ] 10.4 Prompt user to commit with this conventional commit message:

      ```
      feat(map): always-visible tour action bar (#169)

      Move tours + add-tour FABs out of the speed dial into a persistent
      bottom-center action bar. Hide the bar while a side drawer or pick
      flow is active; visible-but-disabled while a non-tour overlay is
      open. Add an add-tour button at the top of the tour list sheet.
      ```

- [ ] 10.5 Prompt user to push branch and open a PR against `main`, referencing issue #169
