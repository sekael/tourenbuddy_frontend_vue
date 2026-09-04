## MODIFIED Requirements

### Requirement: Sheet content scrolls independently of drag

Inner content overflow SHALL scroll independently. Scrolling within the content area SHALL NOT initiate a resize drag, and resize dragging the handle SHALL NOT scroll the content area.

Content scroll SHALL be contained: when the content area is scrolled past either end, the
scroll SHALL NOT chain to any ancestor — not the page, not the document, and not the map
behind it. The content area's own end-of-scroll affordance (rubber-band on platforms that
provide one) SHALL be preserved.

#### Scenario: Scrolling content does not resize

- **WHEN** the content area overflows
- **AND** the user scrolls within the content area
- **THEN** the sheet height SHALL remain unchanged

#### Scenario: Overscrolling content does not scroll anything behind it

- **WHEN** the content area is scrolled to its top or bottom edge
- **AND** the user continues the scroll gesture in the same direction
- **THEN** no ancestor scroll container SHALL scroll
- **AND** the document scroll offset SHALL remain unchanged

### Requirement: Sheet content scrolls vertically only

The content area SHALL scroll on the vertical axis only. It SHALL NOT expose a horizontal
scrollbar or respond to a horizontal scroll/swipe gesture, regardless of child content
width. Row-level content that could otherwise force horizontal overflow (a value next to a
leading icon, a wrapped chip list) SHALL be laid out to shrink and wrap within the sheet's
width instead.

#### Scenario: Wide row content wraps instead of scrolling sideways

- **WHEN** a row's value content (e.g. coordinates, a place name, a list of chips) is wider than the sheet
- **THEN** that content SHALL wrap onto additional lines
- **AND** the content area SHALL NOT scroll horizontally to reveal it

#### Scenario: Horizontal swipe over the content area does nothing

- **WHEN** the user swipes or drags horizontally within the content area
- **THEN** the content area SHALL NOT scroll horizontally
