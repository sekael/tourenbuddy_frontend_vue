## Why

Multiple bottom sheets can stack on top of each other (e.g. opening the tour info sheet by clicking a marker while the feedback sheet is open, or opening the feedback sheet while the contacts list sheet is open). The result is overlapping modal surfaces with unclear focus, broken backdrop semantics, and a confusing close-order. Issue [#35](https://github.com/sekael/tourenbuddy_frontend_vue/issues/35) requires that only a single modal bottom sheet (or the desktop tour info side drawer) is visible at any time.

## What Changes

- Introduce a single source of truth for the currently open overlay on `MapPage` (feedback, profile, contacts list, tour info). At most one overlay is open at any time.
- Opening any overlay automatically closes the previously open overlay (including clearing the selected tour when a non-tour sheet opens, and closing all sheets when a tour marker is clicked).
- `closeTourInfo`, `showFeedbackSheet`, `showProfileSheet`, and `showContactDialog` flag-based local refs are replaced by a single `activeOverlay` ref managed via `openOverlay(name)` / `closeOverlay()` helpers.
- Map background click closes the active overlay regardless of which sheet was open (existing behavior, but routed through the new helper).
- Tour selection in `mapStore` remains the source of truth for tour identity, but its visibility is gated by `activeOverlay === 'tour'`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `responsive-overlay`: add a single-active-overlay requirement covering both `BottomSheet` consumers and the `SideDrawer`-rendered `TourInfoSheet`.

## Impact

- `src/features/map/presentation/pages/map-page.vue`: refactor sheet visibility state into single `activeOverlay` ref + helpers.
- `test/features/map/presentation/pages/map-page.test.ts` (new or extended): cover the mutual-exclusion behavior across all four overlays.
- No public API, dependency, or backend changes.
