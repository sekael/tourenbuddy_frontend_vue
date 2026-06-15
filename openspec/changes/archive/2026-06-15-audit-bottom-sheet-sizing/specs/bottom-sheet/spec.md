## ADDED Requirements

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
