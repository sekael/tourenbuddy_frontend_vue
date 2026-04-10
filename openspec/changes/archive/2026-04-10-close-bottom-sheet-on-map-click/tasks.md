## 0. Git setup

- [x] 0.0 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/7-close-bottom-sheet-on-map-click`

## 1. Shared BottomSheet wrapper

- [x] 1.1 Create `src/core/components/bottom-sheet.vue` with props `title?: string`, `ariaLabel?: string` and emit `close`
- [x] 1.2 Implement the shared visual contract: width 100% / shared `max-width`, shared `max-height` with internal `overflow-y: auto`, top-rounded corners, border, shadow, drag handle, shared inner padding via design tokens
- [x] 1.3 Render a header with optional title (`<h2>`) and a uniform 32×32 icon close button (`material-symbols-outlined: close`) that emits `close`
- [x] 1.4 Add a11y attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-label`, accessible "Close" label on the button
- [x] 1.5 Component tests: renders title, renders default slot, close button emits `close`, content area scrolls when overflowing

## 2. Refactor existing sheets to use BottomSheet

- [x] 2.1 Refactor `tour-info-sheet.vue` to wrap content in `<BottomSheet :title="displayName" @close="emit('close')">`; remove bespoke `.sheet`/`.drag-handle`/`.header`/`.close-btn` styles
- [x] 2.2 Refactor `user-profile-sheet.vue` similarly with `title="Profile"`
- [x] 2.3 Refactor `feedback-sheet.vue` to use `<BottomSheet title="Feedback" @close="emit('close')">`; remove the bottom-of-content text "Close" button and the bespoke surface styles; keep `ErrorSnackbar` as a sibling outside the sheet
- [x] 2.4 Visually verify all three sheets render with identical sizing and header

## 3. Map background click event

- [x] 3.1 Identify the tour marker layer ID(s) used in `tourenbuddy-map.vue` and export them as constants if not already
- [x] 3.2 Add a MapLibre `click` listener in `tourenbuddy-map.vue` that uses `queryRenderedFeatures` to detect tour-marker hits
- [x] 3.3 Emit a new `map-background-click` event when the click does not hit a tour marker
- [x] 3.4 Ensure existing `tour-clicked` behavior on marker hits is unchanged
- [x] 3.5 Verify pan/zoom/rotate gestures do not trigger the new event (rely on MapLibre `click` semantics)

## 4. Wire dismissal in map page

- [x] 4.1 In `map-page.vue`, listen for `@map-background-click` from `TourenbuddyMap`
- [x] 4.2 On the event, close any open sheet: clear `selectedTourId` via `mapStore.selectTour(null)`, set `showFeedbackSheet = false`, set `showProfileSheet = false`
- [x] 4.3 Add a brief code comment documenting that any new bottom sheet must be wired into this handler

## 5. Tests

- [x] 5.1 Component test: tour info sheet closes on `map-background-click`
- [x] 5.2 Component test: feedback sheet closes on `map-background-click`
- [x] 5.3 Component test: user profile sheet closes on `map-background-click`
- [x] 5.4 Component test: clicking a tour marker switches sheets and does not leave an empty state
- [x] 5.5 Component test: existing close button still dismisses each sheet
- [x] 5.6 Unit test (or component test) ensuring map clicks on marker features do NOT emit `map-background-click`

## 6. Quality gates

- [x] 6.1 `npm run lint` passes with zero warnings
- [x] 6.2 `npm run type-check` passes
- [x] 6.3 `npm run test` passes
- [x] 6.4 `npm run format` applied
