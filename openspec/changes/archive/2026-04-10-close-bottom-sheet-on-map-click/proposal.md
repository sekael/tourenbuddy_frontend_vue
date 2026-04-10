## Why

Closing modal bottom sheets currently requires hitting a small dedicated close button or icon, which is awkward on touch devices and inconsistent with the natural "tap-outside-to-dismiss" gesture users expect from modal sheets on a map. Allowing users to dismiss a sheet by tapping anywhere on the underlying map makes navigation faster and more forgiving.

## What Changes

- Tapping/clicking on the map area outside any open modal bottom sheet dismisses the currently open sheet.
- Applies to all modal bottom sheets hosted on the map page: `TourInfoSheet`, `FeedbackSheet`, and `UserProfileSheet`.
- Clicks that occur on the sheet itself (or its interactive controls) must NOT close the sheet.
- Tour-marker clicks remain functional: clicking another tour marker while a sheet is open transitions to that tour's info sheet rather than just closing.
- Map gestures (pan, zoom, pitch, rotate) continue to work; only a discrete tap/click outside the sheet triggers dismissal.
- Introduce a shared `BottomSheet` wrapper component in `core/components/` that enforces a consistent visual contract across all modal bottom sheets:
  - Same horizontal sizing rules: full screen width on small viewports, capped at a shared `max-width` on larger viewports, centered horizontally.
  - Same vertical sizing rules: height adapts to content with a shared `max-height` (capped relative to viewport) and internal scrolling when content overflows.
  - Same surface treatment: background, top-rounded corners, border/shadow, drag handle, and consistent inner padding using shared design tokens.
  - Same explicit close control: an icon close button in a uniform header position, accessible via keyboard, in addition to the new tap-outside-to-close gesture.
- Refactor `TourInfoSheet`, `FeedbackSheet`, and `UserProfileSheet` to use the shared `BottomSheet` wrapper, removing their bespoke sizing/close-button styles.

## Capabilities

### New Capabilities

<!-- None -->

### Modified Capabilities

- `map-integration`: Add a requirement that a map tap/click outside an open modal bottom sheet dismisses that sheet.
- `design-system`: Add a requirement defining the consistent visual and interaction contract for modal bottom sheets (sizing, header, close control).

## Impact

- Affected code:
  - `src/core/components/bottom-sheet.vue` (new) — shared wrapper enforcing sizing, header, and close-button contract.
  - `src/features/map/presentation/pages/map-page.vue` — central host of all bottom sheets; will coordinate dismissal.
  - `src/features/map/presentation/components/tourenbuddy-map.vue` — must emit a map-click (background tap) event.
  - `src/features/tours/presentation/components/tour-info-sheet.vue`, `src/core/components/feedback-sheet.vue`, `src/features/user/presentation/components/user-profile-sheet.vue` — refactored to wrap content in `BottomSheet`; bespoke sizing/close-button styles removed. Today these diverge: `feedback-sheet` uses a text "Close" button at the bottom and a different surface, while the other two use a top-right icon button — this change unifies them.
- No backend, schema, or dependency changes.
- Tests:
  - Component tests for `map-page.vue` covering dismissal behavior across all three sheets.
  - Component tests for `BottomSheet` covering header rendering, close button emission, and content slot.
