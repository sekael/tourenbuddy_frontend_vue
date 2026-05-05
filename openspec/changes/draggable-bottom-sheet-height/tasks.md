## 1. Git Setup

- [x] 1.1 Create branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/draggable-bottom-sheet-height`

## 2. Component: drag state + snap points

- [x] 2.1 Add internal state to `src/core/components/bottom-sheet.vue`: `currentHeight` (px ref), `isDragging` (bool ref), `lastSnap` (`'peek' | 'default' | 'expanded'`).
- [x] 2.2 Compute snap point heights: measure header+handle for `peek` via `ResizeObserver`; `default = 0.4 * window.innerHeight`; `expanded = 0.6 * window.innerHeight`. Recompute on viewport resize.
- [x] 2.3 Replace static `max-height: 60vh` rule with bound inline `height` style driven by `currentHeight`; keep `max-height: 60vh` as hard ceiling.

## 3. Pointer drag interaction

- [x] 3.1 Add `pointerdown` handler on `.drag-handle`: capture pointer, record `startY`, `startHeight`, set `isDragging = true`, add `bottom-sheet--dragging` class to disable transition, apply `touch-action: none`.
- [x] 3.2 Add `pointermove` handler: `newHeight = clamp(startHeight - (e.clientY - startY), peek, expanded)`; ignore if `collapsed`.
- [x] 3.3 Add `pointerup`/`pointercancel` handler: release capture, clear `isDragging`, snap to nearest of {peek, default, expanded} biased by drag direction; treat <4px movement as no-op tap.
- [x] 3.4 Watch `props.collapsed` — if it flips to true mid-drag, release pointer capture and cancel drag.

## 4. Animation + styles

- [x] 4.1 Add CSS `transition: height 200ms ease-out` to `.bottom-sheet`; suppress while `.bottom-sheet--dragging`.
- [x] 4.2 Style drag handle for affordance: enlarge tap target to ~24px tall (transparent padding), keep visual bar 36×4. Cursor `ns-resize` on desktop pointer devices. `touch-action: none`.

## 5. Accessibility

- [x] 5.1 Add `role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin="0"`, `aria-valuemax="2"`, `aria-valuenow` (snap index), `tabindex="0"` to drag handle.
- [x] 5.2 Add keydown handler: ArrowUp → next-larger snap, ArrowDown → next-smaller snap, Home → expanded, End → peek.
- [x] 5.3 Add `aria-label` (i18n key e.g. `core.bottomSheet.resizeHandle`) — add to `en.json` and `de-CH.json`.

## 6. Tests

- [x] 6.1 Create `test/core/components/bottom-sheet.spec.ts`. Mock viewport to fixed `innerHeight`.
- [x] 6.2 Test: tap on handle (<4px move) does not change height.
- [x] 6.3 Test: drag up past midpoint snaps to expanded; drag down past midpoint snaps to peek.
- [x] 6.4 Test: height clamped to peek floor and 60vh ceiling regardless of drag distance.
- [x] 6.5 Test: when `collapsed` prop true, handle is not rendered and pointerdown on header area does not start drag.
- [x] 6.6 Test: ArrowUp/ArrowDown on focused handle cycle snap points and update `aria-valuenow`.
- [x] 6.7 Test: scrolling inside `.content` does not modify sheet height.

## 7. Manual verification

- [x] 7.1 `npm run dev` — open mobile viewport (Chrome devtools touch emulation). Verify drag, snap, ceiling on tour-info sheet with GPX-rich tour.
- [x] 7.2 Verify location-picker flow: opening picker collapses sheet via `collapsed` prop; exiting restores last user snap.
- [x] 7.3 Test on a real iOS Safari device (or simulator) to confirm no body rubber-band scroll while dragging.

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix && npm run format && npm run type-check && npm run test`.
- [ ] 8.2 Prompt user to commit. Suggested message:

  ```
  feat(core): make BottomSheet height draggable with snap points

  Drag handle in BottomSheet now resizes the sheet between peek, default,
  and 60vh-expanded snap points (touch + pointer + keyboard). Hard 60vh
  ceiling preserved so the map stays partially visible. Programmatic
  `collapsed` prop unchanged.
  ```

- [ ] 8.3 Prompt user to push branch and open PR against `main`.
