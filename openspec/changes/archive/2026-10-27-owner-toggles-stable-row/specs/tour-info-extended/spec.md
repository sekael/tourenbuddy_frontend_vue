## ADDED Requirements

### Requirement: Owner toggles keep one layout in every state

The owner toggles row SHALL lay out the same way whether the tour is completed, private, both or neither: each toggle SHALL be as wide as its longer label, so flipping a toggle never moves the row between one and two lines. The labels SHALL fit both toggles on one line on a 375 px wide phone in every supported locale.

#### Scenario: Flipping a toggle keeps the row

- **WHEN** the owner marks a tour completed or private, or reverses either
- **THEN** both toggles SHALL keep their width and the row its number of lines

#### Scenario: Phone width

- **WHEN** the owner opens a tour on a 375 px wide screen in any supported locale
- **THEN** both toggles SHALL share one line, in every state

#### Scenario: Too narrow for one line

- **WHEN** the row is too narrow for both toggles side by side
- **THEN** each toggle SHALL take a full line, in every state
