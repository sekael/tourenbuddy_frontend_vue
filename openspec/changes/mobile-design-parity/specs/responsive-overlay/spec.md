## ADDED Requirements

### Requirement: Mobile sheets follow their content

On viewports below 600px a fit-content `BottomSheet` SHALL open at its content height, capped at 70% of the visible viewport, and SHALL glide to the new height whenever the content changes (view, tab or loaded data) in both directions. When the content needs more than the opening height the sheet SHALL show a drag handle and let the user expand it to the full content (capped at 90%) or drop it to peek; when the content fits, the sheet SHALL show no drag handle. A sheet the user dragged to peek SHALL stay at peek when content changes. Snap heights SHALL follow viewport changes (rotation, browser chrome). A fast flick SHALL move the sheet one snap in the flick direction.

#### Scenario: Content shrinks

- **WHEN** the user moves from a long view to a shorter one inside a mobile sheet
- **THEN** the sheet glides down to the shorter content's height, leaving no empty band

#### Scenario: Long list

- **WHEN** the contacts list is taller than 70% of the visible viewport
- **THEN** the sheet opens at 70% with a drag handle, and dragging up expands it to the full list (at most 90%), its content scrolling beyond

#### Scenario: Content fits

- **WHEN** a sheet's content fits within the opening height
- **THEN** no drag handle is shown

#### Scenario: Parked at peek

- **WHEN** the user dragged the sheet down to peek and the content then changes
- **THEN** the sheet stays at peek

#### Scenario: Rotation

- **WHEN** the device rotates while a snap sheet is open
- **THEN** its snap heights are recomputed for the new viewport

### Requirement: Mobile sheet and page swap without a hard cut

On viewports below 600px, switching an overlay between its bottom sheet and its full-screen page (data entry, profile sections) SHALL fade through: the outgoing surface fades out while the incoming one fades in (the page with a short rise). Closing an overlay from its full-screen page SHALL fade the page out. Modal bottom sheets SHALL fade in their scrim and rise in on open and fade out on close; sheets on the calendar SHALL slide in and out like those on the map.

#### Scenario: Opening a profile section on mobile

- **WHEN** the user taps a settings row in the profile sheet
- **THEN** the sheet fades out while the section page rises in, with no frame where either pops

#### Scenario: Saving a full-screen form

- **WHEN** the user saves the tour edit page and returns to the tour sheet
- **THEN** the page fades out over the tour sheet

### Requirement: Browse sheets are always resizable

On viewports below 600px the tour list and tour detail sheets SHALL always show a drag handle and SHALL snap to peek, the opening height (content height, at most 40% of the visible viewport) and the full content height (at most 70%).

#### Scenario: Short tour detail

- **WHEN** a tour's details fit within 40% of the viewport
- **THEN** the sheet still shows a drag handle and can be dropped to peek to reveal the map

#### Scenario: Dragging up a sheet already at its full content

- **WHEN** the user drags the handle or the header (outside its buttons) above the top snap
- **THEN** the sheet follows with growing resistance (at most 48px) and settles back on release

### Requirement: Opening a tour frames its points in the visible map

Opening a tour's detail (from a marker or the tour list) SHALL move the camera so the tour's points fill the map area not covered by the bottom sheet (mobile, at its resting height) or the side drawer (desktop): a lone goal is centred there at zoom 12; with a start point, start and goal are both shown; with a distinct end point, start, goal and end are shown. Framing several points SHALL NOT zoom in beyond zoom 12, and SHALL keep the map's bearing.

#### Scenario: Round trip

- **WHEN** a tour's end point equals its start point
- **THEN** the camera frames exactly as for a tour with only start and goal

#### Scenario: Goal only on a phone

- **WHEN** a tour with only a goal opens in the bottom sheet
- **THEN** the goal sits centred in the map area above the sheet

### Requirement: Tabs in a mobile sheet do not resize it

Switching tabs inside a mobile bottom sheet (friend requests: Requests / Blocked) SHALL NOT change the sheet's height; the sheet SHALL be as tall as the taller tab.

#### Scenario: Switching to Blocked

- **WHEN** the user switches from Requests to Blocked in the friend requests sheet on mobile
- **THEN** the sheet keeps its height and only the tab content changes
