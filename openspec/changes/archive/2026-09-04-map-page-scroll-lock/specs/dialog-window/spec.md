## ADDED Requirements

### Requirement: Dialog body scroll is contained

The scrollable body region of `DialogWindow` SHALL contain its scroll: when scrolled past
either end, the scroll SHALL NOT chain to any ancestor — not the page behind the dialog,
not the document, and not a map rendered beneath it. The region's own end-of-scroll
affordance (rubber-band on platforms that provide one) SHALL be preserved.

#### Scenario: Overscrolling a dialog does not move the page behind it

- **WHEN** the dialog body is scrolled to its top or bottom edge
- **AND** the user continues the scroll gesture in the same direction
- **THEN** no ancestor scroll container SHALL scroll
- **AND** the document scroll offset SHALL remain unchanged

### Requirement: Dialog body scrolls vertically only

The dialog body SHALL scroll on the vertical axis only, regardless of child content width.

#### Scenario: Horizontal swipe over the dialog body does nothing

- **WHEN** the user swipes or drags horizontally within the dialog body
- **THEN** the dialog body SHALL NOT scroll horizontally
