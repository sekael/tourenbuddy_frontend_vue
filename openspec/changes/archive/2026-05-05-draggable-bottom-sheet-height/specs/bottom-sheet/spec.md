## ADDED Requirements

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
