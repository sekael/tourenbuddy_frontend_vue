## Why

On iOS PWA (added to home screen, standalone display), the tour attachment viewer's header renders behind the device status bar. The close button sits under the status bar and cannot be tapped, trapping users in the viewer (issue #194). The same risk exists on Android PWA in standalone mode where the system status bar overlays the viewport when `viewport-fit=cover` is set. The viewer also offers no gesture alternative to dismiss — only the obscured close button.

## What Changes

- Header of `tour-attachment-viewer.vue` SHALL respect `safe-area-inset-top` so the close & download controls clear the system status bar on both iOS and Android PWAs in standalone mode.
- Bottom UI of the viewer (dots indicator, PDF page nav) SHALL respect `safe-area-inset-bottom` so it clears the iOS home indicator and the Android gesture navigation bar.
- Side nav arrows SHALL respect `safe-area-inset-left` / `-right` for landscape orientation.
- Viewer SHALL close on a swipe-down gesture past a distance threshold — the native idiom on both iOS (Photos) and Android (Google Photos) for dismissing a full-screen image. Swipe-up SHALL NOT close the viewer.
- Horizontal swipe behavior (prev/next) MUST remain intact; gesture classification chooses by dominant axis.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tour-attachments`: full-screen viewer requirements extend to cover safe-area insets and vertical swipe-to-close.

## Impact

- Code: `src/features/tours/presentation/components/tour-attachment-viewer.vue` (CSS + touch handlers).
- Tests: `test/features/tours/presentation/components/tour-attachment-viewer.spec.ts` (new or extended).
- No DB, no API, no dependency changes.
- Visual regression risk on non-iOS browsers where `env(safe-area-inset-*)` resolves to `0px` — fallback already in pattern used elsewhere in codebase.
