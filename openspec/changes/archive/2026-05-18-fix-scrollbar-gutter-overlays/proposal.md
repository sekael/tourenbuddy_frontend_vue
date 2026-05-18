## Why

On mobile (browser + PWA) and desktop, scrollable overlay content (bottom-sheet, dialog, side-drawer) renders the scrollbar directly over text, buttons, and toggles at the right edge. Looks broken and obscures interactive controls (issue #155).

## What Changes

- Reserve scrollbar gutter on the three overlay scroll containers so the scrollbar never overlaps content:
  - `bottom-sheet.vue` → `.content`
  - `dialog-window.vue` → `.dialog-content` (already has thin styling; add gutter)
  - `side-drawer.vue` → scrollable area
- Apply `scrollbar-gutter: stable` for layout-reserved gutter.
- Apply thin custom scrollbar styling (`scrollbar-width: thin` + `::-webkit-scrollbar` thin variant) consistently across all three.
- Add a small `padding-right` (e.g., `--spacing-xs`) as fallback for mobile overlay scrollbars (iOS Safari / Android Chrome) that ignore `scrollbar-gutter`.
- No new tokens, no new APIs. Pure CSS adjustments to existing components.

## Capabilities

### New Capabilities
- _(none)_

### Modified Capabilities
- `bottom-sheet`: scroll content MUST reserve a scrollbar gutter; scrollbar styling MUST be thin.
- `dialog-window`: scroll content MUST reserve a scrollbar gutter (existing thin styling retained).
- `side-drawer`: scroll content MUST reserve a scrollbar gutter; scrollbar styling MUST be thin.

## Impact

- Files: `src/core/components/bottom-sheet.vue`, `src/core/components/dialog-window.vue`, `src/core/components/side-drawer.vue`.
- No public API change, no behavior change beyond visual gutter.
- Touches every page rendered inside these overlays (user profile, tour info, contacts list, dialogs).
- No DB / no i18n / no test fixtures impacted.
