## Context

`BottomSheet` (`src/core/components/bottom-sheet.vue`) is the mobile shell for tour info, contact list, feedback, profile, etc. Today it has fixed `max-height: 60vh` and a purely decorative drag handle. On mobile, tour info with GPX data leaves only ~40vh of map visible — users can't preview the GPX track in context without dismissing the sheet. Users intuitively try to drag the handle and nothing happens.

The component already supports a programmatic `collapsed` prop used by `tour-info-sheet` during location picking (header-only mode). That stays as-is — programmatic collapse is orthogonal to user-driven resize.

## Goals / Non-Goals

**Goals:**

- User can drag the handle (touch + pointer) to resize the sheet between snap points.
- Three snap points: `peek` (header only), `default` (~40vh), `expanded` (60vh).
- Hard ceiling at 60vh — map always partially visible.
- Smooth release animation; tap on handle (no movement) does nothing.
- Works inside existing `pointer-events: none` parent container.
- Keyboard accessibility on the handle.

**Non-Goals:**

- Free-form arbitrary heights (snap on release).
- Desktop side-drawer resizing — out of scope.
- Persisting last-used height across sessions.
- Velocity-based fling beyond simple direction-of-release snap.
- Replacing `collapsed` prop with internal state — programmatic + user state coexist.

## Decisions

### 1. Snap points as `vh` constants, height as ref

State: `currentHeight: Ref<number>` in px (computed from vh on mount + on resize). Snap targets: `PEEK ≈ header height (~64px)`, `DEFAULT = 40vh`, `EXPANDED = 60vh`. Easier than CSS-only — needs JS for drag math anyway.

Alternative considered: CSS `resize: vertical` on the sheet. Rejected — no snap, no max relative to viewport, ugly native handle, broken on iOS Safari.

### 2. Pointer Events API (not separate touch/mouse)

Single `pointerdown`/`pointermove`/`pointerup` path with `setPointerCapture`. Handles touch, mouse, pen uniformly. Add `touch-action: none` on the handle to suppress browser scroll/refresh.

### 3. Drag math

On `pointerdown`: record `startY`, `startHeight`. On `pointermove`: `newHeight = clamp(startHeight - (e.clientY - startY), PEEK, EXPANDED)`. Note inversion — dragging up grows the sheet. On `pointerup`: snap to nearest of `{PEEK, DEFAULT, EXPANDED}` weighted by drag direction (if released moving up, prefer next-larger snap, and vice versa).

Threshold: ignore movements <4px (treat as tap → no-op).

### 4. Animation

CSS `transition: height 200ms ease-out` toggled off during active drag (class `bottom-sheet--dragging`) and on for snap-back. Avoids jank during drag.

### 5. Keyboard a11y

Handle becomes `role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin/max/now` reflecting snap index, `tabindex="0"`. ↑/↓ arrows cycle snap points. Enter/Space toggle peek↔default.

### 6. Interaction with `collapsed` prop

When `collapsed === true`, drag is disabled, handle hidden (already is), height forced to header. When parent flips `collapsed` back to false, sheet returns to its prior user-set snap (or `DEFAULT` on first show).

### 7. Content overflow

`.content` is already `overflow-y: auto`. Drag is initiated only on the handle, so inner scroll is unaffected. No nested-scroll conflict.

## Risks / Trade-offs

- [iOS Safari rubber-band scroll on body during drag] → `touch-action: none` on handle + `e.preventDefault()` on `pointermove` while dragging.
- [Sheet in `pointer-events: none` container] → handle and sheet already set `pointer-events: auto`; drag handlers attach to handle, no change needed.
- [Layout shift if `collapsed` flips during user drag] → cancel active drag on `collapsed` change (release pointer capture).
- [Snap target overlaps content] → `peek` keeps header fully visible; content is hidden via `overflow` so no clipping awkwardness.
- [Existing tests using sheet height] → none found; verify after wire-up.

## Migration Plan

Pure additive change to a shared component. No consumer API changes. Deploy in one step. Rollback = revert PR.

## Open Questions

- Should `peek` height equal exactly the header (`~64px`) or include the drag handle (`+8px margin`)? → resolve in implementation by measuring `.header` + `.drag-handle` via `ResizeObserver` for robustness across font/spacing tokens.
