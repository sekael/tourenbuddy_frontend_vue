## ADDED Requirements

### Requirement: Drawer content scroll is contained

The scrollable content region of `SideDrawer` SHALL contain its scroll: when scrolled past
either end, the scroll SHALL NOT chain to any ancestor — not the page behind the drawer,
not the document, and not a map rendered beside or beneath it. The region's own
end-of-scroll affordance (rubber-band on platforms that provide one) SHALL be preserved.

Containment SHALL apply to the drawer's own scroll region only. It SHALL NOT affect input
directed at surfaces outside the drawer: while a drawer is open, the portion of the map
still visible SHALL remain fully interactive (see `map-integration`).

#### Scenario: Overscrolling the drawer does not move the page behind it

- **WHEN** the drawer content is scrolled to its top or bottom edge
- **AND** the user continues the scroll gesture in the same direction
- **THEN** no ancestor scroll container SHALL scroll
- **AND** the document scroll offset SHALL remain unchanged

#### Scenario: Map stays zoomable next to an open drawer

- **WHEN** a side drawer is open over part of the map
- **AND** the user scroll-wheels or pinches over the still-visible portion of the map
- **THEN** the map SHALL zoom
- **AND** the drawer's scroll position SHALL remain unchanged

### Requirement: Drawer content scrolls vertically only

The drawer's scrollable content region SHALL scroll on the vertical axis only, regardless
of child content width.

#### Scenario: Horizontal swipe over the drawer content does nothing

- **WHEN** the user swipes or drags horizontally within the drawer content region
- **THEN** the drawer content SHALL NOT scroll horizontally
