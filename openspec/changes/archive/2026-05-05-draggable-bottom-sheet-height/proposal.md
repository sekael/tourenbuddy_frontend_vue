## Why

Mobile bottom sheet (`BottomSheet`) fixed at `max-height: 60vh` and not draggable. Tour info on mobile, especially with GPX tracks, leaves only ~40% of screen for the map — cumbersome to inspect track on map without closing the sheet. Drag handle is decorative, users expect it to resize.

## What Changes

- Make `BottomSheet` height user-adjustable via touch/pointer drag on existing drag handle.
- Snap points: collapsed (header-only, ~peek), default (~40vh), expanded (60vh max). User can rest at intermediate heights or snap to nearest on release.
- Preserve existing `collapsed` prop behavior (programmatic header-only mode for location picker) — drag disabled while `collapsed` is true.
- Keep 60vh hard ceiling so map always remains partly visible.
- Drag works on touch and mouse/pointer; keyboard a11y via aria controls or focusable handle with arrow keys to cycle snap points.
- Desktop side-drawer path unaffected (mobile `<600px` only).

## Capabilities

### New Capabilities

- `bottom-sheet`: Mobile bottom-sheet primitive — rendering, header, collapse, drag-to-resize behavior, snap points, accessibility.

### Modified Capabilities

<!-- none -->

## Impact

- `src/core/components/bottom-sheet.vue` — add drag state, pointer handlers, height ref, snap logic.
- Consumers: `tour-info-sheet.vue`, `side-drawer.vue` (mobile branch), and any `AdaptiveOverlay` users — no API change required; new behavior opt-in via existing drag handle.
- New tests under `test/core/components/bottom-sheet.spec.ts`.
- No backend, no data, no i18n strings (drag has no visible label).
