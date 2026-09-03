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
