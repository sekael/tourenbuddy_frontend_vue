## MODIFIED Requirements

### Requirement: Browse sheets are always resizable

On viewports below 600px the tour list and tour detail sheets SHALL always show a drag handle and SHALL snap to peek, the opening height (content height, at most 40% of the visible viewport) and the full content height (at most 70%). While the tour list shows its filters, it SHALL instead open at their content height, at most 70%, and expand to at most 90%.

#### Scenario: Short tour detail

- **WHEN** a tour's details fit within 40% of the viewport
- **THEN** the sheet still shows a drag handle and can be dropped to peek to reveal the map

#### Scenario: Dragging up a sheet already at its full content

- **WHEN** the user drags the handle or the header (outside its buttons) above the top snap
- **THEN** the sheet follows with growing resistance (at most 48px) and settles back on release

#### Scenario: Tour list filters open

- **WHEN** the user opens the filters of the tour list on a phone
- **THEN** the sheet SHALL grow to show them at up to 70% of the visible viewport and SHALL be draggable to 90%
- **AND** closing the filters SHALL return the sheet to the browse snaps
