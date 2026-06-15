## Purpose

Mobile-optimized modal surface that slides up from the bottom edge, supporting drag-to-dismiss and snap heights.

## Requirements

### Requirement: Bottom sheet renders header, content, optional footer

The `BottomSheet` component SHALL render a drag handle, a header (title + close button, optional back button), a scrollable content slot, and an optional footer slot. Width SHALL be capped at `--bottom-sheet-max-width` (default 480px). The sheet SHALL be anchored to the bottom edge of its container.

#### Scenario: Renders title and close

- **WHEN** the component is mounted with a `title` prop
- **THEN** the title SHALL be visible in the header
- **AND** a close button SHALL be visible
- **AND** clicking the close button SHALL emit `close`

#### Scenario: Renders footer slot when provided

- **WHEN** a `footer` slot is provided
- **THEN** the footer region SHALL render below the content with a top border separator

### Requirement: Bottom sheet height is user-adjustable via drag handle

The drag handle SHALL act as a resize control. The user SHALL be able to drag the handle vertically (touch or pointer) to change the sheet height. Sheet height SHALL be clamped between a peek height (header-only) and a maximum of 60vh. Dragging up SHALL grow the sheet; dragging down SHALL shrink it. The maximum height SHALL never exceed 60vh so the underlying map remains partially visible.

#### Scenario: Drag up grows the sheet

- **WHEN** the sheet is at its default height
- **AND** the user presses the drag handle and moves the pointer up by 100px
- **THEN** the sheet height SHALL increase by approximately 100px
- **AND** the sheet height SHALL NOT exceed 60vh

#### Scenario: Drag down shrinks the sheet

- **WHEN** the sheet is at its default height
- **AND** the user presses the drag handle and moves the pointer down by 100px
- **THEN** the sheet height SHALL decrease by approximately 100px
- **AND** the sheet height SHALL NOT shrink below the peek height (header only)

#### Scenario: Hard 60vh ceiling

- **WHEN** the user drags the handle further up after the sheet has already reached 60vh
- **THEN** the sheet height SHALL remain at 60vh

### Requirement: Sheet snaps to nearest snap point on release

On pointer release after a drag, the sheet SHALL animate to the nearest of three snap points: `peek` (header only), `default` (≈40vh), `expanded` (60vh). Snap selection SHALL be biased by drag direction at release (releasing while moving up prefers the next-larger snap; releasing while moving down prefers the next-smaller snap). Movements smaller than 4px SHALL be treated as a tap and SHALL NOT trigger a snap change.

#### Scenario: Release after upward drag past midpoint

- **WHEN** the user starts at default and drags up past the midpoint between default and expanded
- **AND** releases the pointer
- **THEN** the sheet SHALL animate to the expanded snap (60vh)

#### Scenario: Tap on drag handle has no effect

- **WHEN** the user presses and releases the drag handle without moving more than 4px
- **THEN** the sheet height SHALL remain unchanged
- **AND** no snap animation SHALL occur

### Requirement: Drag is disabled when sheet is programmatically collapsed

When the `collapsed` prop is true, the drag handle SHALL be hidden and drag interactions SHALL be ignored. When `collapsed` transitions from true to false, the sheet SHALL restore the user's last snap point, or `default` if none has been set.

#### Scenario: Collapsed prop true hides handle

- **WHEN** `collapsed` is true
- **THEN** the drag handle SHALL NOT be rendered
- **AND** pointer events on the header area SHALL NOT initiate a resize drag

#### Scenario: Collapsed prop flips during active drag

- **WHEN** the user is mid-drag
- **AND** the parent sets `collapsed` to true
- **THEN** the active drag SHALL be cancelled
- **AND** pointer capture SHALL be released

### Requirement: Drag handle is keyboard accessible

The drag handle SHALL be focusable and operable via keyboard. It SHALL expose `role="separator"`, `aria-orientation="horizontal"`, and `aria-valuemin`, `aria-valuemax`, `aria-valuenow` reflecting the current snap point index. Arrow keys SHALL cycle between snap points.

#### Scenario: Arrow up cycles to larger snap

- **WHEN** the drag handle is focused at the `default` snap
- **AND** the user presses ArrowUp
- **THEN** the sheet SHALL animate to the `expanded` snap

#### Scenario: Arrow down cycles to smaller snap

- **WHEN** the drag handle is focused at the `default` snap
- **AND** the user presses ArrowDown
- **THEN** the sheet SHALL animate to the `peek` snap

### Requirement: Sheet content scrolls independently of drag

Inner content overflow SHALL scroll independently. Scrolling within the content area SHALL NOT initiate a resize drag, and resize dragging the handle SHALL NOT scroll the content area.

#### Scenario: Scrolling content does not resize

- **WHEN** the content area overflows
- **AND** the user scrolls within the content area
- **THEN** the sheet height SHALL remain unchanged

### Requirement: Content scroll region reserves scrollbar gutter

The scrollable content region of `BottomSheet` SHALL reserve space for the scrollbar so that the scrollbar never overlaps text, buttons, or interactive controls. The scrollbar SHALL render with a thin, app-consistent style.

#### Scenario: Desktop / Chromium browsers with reservable gutter
- **WHEN** content overflows the sheet's content region in a browser that honors `scrollbar-gutter`
- **THEN** a scrollbar gutter SHALL be reserved on the inline-end side
- **AND** content SHALL NOT shift horizontally when the scrollbar appears or disappears

#### Scenario: Mobile browsers with overlay scrollbars
- **WHEN** content overflows the sheet's content region on iOS Safari or Android Chrome
- **THEN** the overlay scrollbar SHALL sit over reserved right padding inside the content region
- **AND** the scrollbar SHALL NOT overlap text, buttons, or toggles

### Requirement: Sheet supports a fit-content sizing mode

When the `fitContent` prop is true, the sheet SHALL size itself to `min(natural content height, 60vh)` instead of opening at a snap point, so the entire content is visible without dragging. In this mode the sheet SHALL refit when the viewport resizes (e.g. the on-screen keyboard opening or rotation) and SHALL NOT snap to `peek` / `default` / `expanded`. The drag handle remains operable, but the sheet's resting height is content-driven, not snap-driven. When `fitContent` is absent or false, the sheet SHALL retain the default snap behavior.

#### Scenario: Short content opens fully visible

- **WHEN** a sheet with `fitContent` is opened and its content is shorter than 60vh
- **THEN** the sheet height SHALL equal the natural content height
- **AND** no part of the content SHALL be clipped or require a drag-up to reveal

#### Scenario: Tall content is capped at the 60vh ceiling

- **WHEN** a sheet with `fitContent` is opened and its content is taller than 60vh
- **THEN** the sheet height SHALL be capped at 60vh
- **AND** the content region SHALL scroll within that ceiling

#### Scenario: Refit on viewport resize

- **WHEN** a `fitContent` sheet is open and the viewport height changes
- **THEN** the sheet SHALL re-measure and re-apply `min(content, 60vh)`
- **AND** SHALL NOT jump to a snap point

### Requirement: Close control stays accessible regardless of sheet height

While the sheet is interactive (not `collapsed`), the close control SHALL be rendered in the pinned header region — outside the scrolling content area — so it remains visible and tappable even when the content overflows or the sheet covers most of the viewport (e.g. a fit-content sheet at the 60vh ceiling). Consumers SHALL NOT hide or override the close control, and SHALL NOT rely on backdrop-tap as the only way to dismiss.

#### Scenario: Close button visible when content overflows

- **WHEN** an interactive sheet's content is taller than the sheet and the content region is scrolled
- **THEN** the close button SHALL remain visible and tappable in the header
- **AND** SHALL NOT scroll out of view with the content

#### Scenario: Close button hidden only when collapsed

- **WHEN** the `collapsed` prop is true
- **THEN** the close button MAY be hidden along with the rest of the interactive chrome
- **AND** it SHALL reappear when `collapsed` returns to false
