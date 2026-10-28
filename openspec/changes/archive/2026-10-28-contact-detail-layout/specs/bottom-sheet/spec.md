## ADDED Requirements

### Requirement: Fit-content sheet follows its footer

A fit-content sheet SHALL count its footer in its fitted height and refit when the footer's
height changes, as it does for its content, within the same caps. Content above the footer then
scrolls under the footer's fade.

#### Scenario: A confirmation opens in the footer
- **WHEN** a fit-content sheet's footer grows (a confirmation replacing a button row)
- **THEN** the sheet grows by as much, up to its cap, and every control in the footer stays on screen
