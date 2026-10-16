# Spec Delta

## ADDED Requirements

### Requirement: Fit-content sheet can hold its height

A `fitContent` sheet SHALL accept an option to hold its height. While held, the sheet SHALL NOT shrink when its content gets shorter; it SHALL still grow with its content, follow user drags and snap normally. When the hold is released, the sheet SHALL refit to its content.

#### Scenario: Content shrinks while held

- **WHEN** a held fit-content sheet's content becomes shorter
- **THEN** the sheet height SHALL stay unchanged

#### Scenario: Content grows while held

- **WHEN** a held fit-content sheet's content becomes taller
- **THEN** the sheet SHALL grow as without the hold, up to its cap

#### Scenario: Hold released

- **WHEN** the hold is released while the sheet is taller than its content
- **THEN** the sheet SHALL refit to its content height
