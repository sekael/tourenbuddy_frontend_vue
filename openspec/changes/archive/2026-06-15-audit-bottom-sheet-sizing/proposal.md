## Why

`BottomSheet` gained a `fitContent` sizing mode in the unlink-warning fix (#85), but it was applied to a single sheet. Every other mobile sheet still inherits snap by accident, not by decision — so confirm/action sheets can open at 40vh and clip their content, forcing a drag-up before the user can act. We want a clear app-wide default (fit content, fully visible) with snap reserved for the few sheets that genuinely benefit from a partial-height view. And because fit-content sheets can cover most of the screen, every sheet must keep an always-reachable close affordance.

## What Changes

- Establish the app convention: mobile sheets default to **`fitContent`** (size to `min(content, 60vh)`, fully visible, no drag-up). **Snap** is opt-out, reserved for `tour-list-sheet` and `tour-info-sheet` — the tour map behind a partial-height sheet is the point there (drag down to reveal/interact with the map).
- Add a `fitContent` prop to `adaptive-overlay`, **defaulting to true**, forwarded to its mobile `BottomSheet` arm. This flips all seven adaptive-overlay sheets to fit-content in one place.
- Set `fit-content` explicitly on the direct `BottomSheet` consumers `contact-action-menu` and `contact-creation-dialog`. `link-edit-warning-dialog` already uses it.
- Leave `tour-list-sheet` and `tour-info-sheet` on the snap default (no prop).
- Formalize the **always-accessible close control**: the close button SHALL stay pinned in the header, visible regardless of content scroll or sheet height, whenever the sheet is interactive. Audit every consumer to confirm it is not hidden or overridden.
- Document the `fitContent` sizing mode (shipped in #85, never spec'd) and the close-accessibility guarantee in the `bottom-sheet` spec; document the passthrough default in `responsive-overlay`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bottom-sheet`: add a requirement specifying the `fitContent` sizing mode, and a requirement that the close control remains visible/pinned regardless of content height.
- `responsive-overlay`: add a requirement that `adaptive-overlay` exposes a `fitContent` prop (defaulting true) forwarded to its mobile `BottomSheet` arm and ignored by the desktop `DialogWindow` arm.

## Impact

- **Components changed:** `core/components/adaptive-overlay.vue` (new prop, default true, forward), `features/contacts/.../contact-action-menu.vue`, `features/contacts/.../contact-creation-dialog.vue` (set `fit-content`).
- **Flipped to fitContent via the wrapper default:** `feedback-sheet`, `tour-creation-dialog`, `contacts-list-sheet`, `phone-verification-dialog`, `user-profile-sheet`, `phone-verification-notice`, `friend-requests-sheet`.
- **Unchanged (snap):** `tour-list-sheet`, `tour-info-sheet`.
- **No DB / API / dependency changes.** Pure presentation.
- **Verification:** viewport/safe-area/keyboard dependent — final sign-off on a real mobile/PWA via the PR preview deploy, including confirming the close button is reachable on every fit-content sheet.
