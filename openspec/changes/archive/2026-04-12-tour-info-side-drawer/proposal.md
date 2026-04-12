## Why

The tour info sheet currently uses the shared `BottomSheet` component, which renders as a centered dialog on desktop (>=600px). This centered dialog obscures the map, preventing users from seeing the selected tour marker and surrounding map context. As the app evolves to show GPX tracks and route details, keeping the map visible while viewing tour information becomes essential. A side drawer sliding in from the right preserves full map visibility on desktop while maintaining the existing mobile bottom sheet behavior unchanged.

## What Changes

- Introduce a new `SideDrawer` component that slides in from the right edge on desktop viewports, with a fixed width (~400px), full viewport height, and a close button
- Modify `TourInfoSheet` to use `SideDrawer` on desktop instead of `BottomSheet`, while keeping `BottomSheet` on mobile
- Update `map-page.vue` to handle the tour info sheet separately from other sheets — it no longer uses the shared `.sheet-container` / `<Transition name="sheet">` wrapper on desktop
- Adjust camera fly-to logic: on desktop, apply right padding (equal to drawer width) instead of no padding, so the marker stays centered in the visible map area
- The `BottomSheet` component and all other sheet consumers (feedback, profile, contact) remain completely unchanged

## Capabilities

### New Capabilities

- `side-drawer`: A responsive side drawer component that slides in from the right on desktop viewports, used for content that needs to coexist with the map view

### Modified Capabilities

- `map-integration`: Camera offset logic changes — desktop tour selection applies right padding instead of zero padding to account for the side drawer
- `responsive-overlay`: Clarify that the `BottomSheet` centered dialog behavior applies to all sheets except `TourInfoSheet`, which uses the side drawer on desktop

## Impact

- `src/core/components/side-drawer.vue` — new shared component
- `src/features/tours/presentation/components/tour-info-sheet.vue` — conditionally render SideDrawer vs BottomSheet
- `src/features/map/presentation/pages/map-page.vue` — separate tour info transition/container for desktop, update camera padding logic
- `test/core/components/side-drawer.test.ts` — new tests for the side drawer component
- Existing tests for bottom-sheet, feedback, profile, and contact sheets are not affected
