## MODIFIED Requirements

### Requirement: Fit-content sheet can hold its height

A `fitContent` sheet SHALL accept an option to hold its height. While held, the sheet SHALL NOT shrink when its content gets shorter; it SHALL still grow with its content, follow user drags and snap normally, and drags and snap keys SHALL reach each snap's full height however short the content is. When the hold is released, the sheet SHALL refit to its content.

#### Scenario: Content shrinks while held

- **WHEN** a held fit-content sheet's content becomes shorter
- **THEN** the sheet height SHALL stay unchanged

#### Scenario: Content grows while held

- **WHEN** a held fit-content sheet's content becomes taller
- **THEN** the sheet SHALL grow as without the hold, up to its cap

#### Scenario: Hold released

- **WHEN** the hold is released while the sheet is taller than its content
- **THEN** the sheet SHALL refit to its content height

#### Scenario: Dragging a held sheet with short content

- **WHEN** a held resizable sheet shows content shorter than its opening height and the user drags it up
- **THEN** the sheet SHALL settle at the full snap height (70% of the visible viewport) rather than springing back to the content height
