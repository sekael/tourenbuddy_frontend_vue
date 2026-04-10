## ADDED Requirements

### Requirement: Consistent modal bottom sheet contract

The application SHALL provide a single shared modal bottom sheet primitive that all modal bottom sheets MUST use, ensuring consistent sizing, surface treatment, and close affordances across the app.

#### Scenario: Uniform horizontal sizing

- **WHEN** any modal bottom sheet is displayed
- **THEN** it spans the full viewport width on small viewports and is capped at the same shared maximum width on larger viewports, centered horizontally

#### Scenario: Uniform vertical sizing and overflow

- **WHEN** any modal bottom sheet is displayed
- **THEN** its height adapts to its content up to the same shared maximum height, and content beyond that height scrolls inside the sheet rather than expanding it

#### Scenario: Uniform surface treatment

- **WHEN** any modal bottom sheet is displayed
- **THEN** it uses the same background color, top-rounded corners, border/shadow, drag handle, and inner padding derived from shared design tokens

#### Scenario: Uniform explicit close button

- **WHEN** any modal bottom sheet is displayed
- **THEN** it shows an icon close button in the same header position, with the same size and accessible label, that emits a close event when activated

#### Scenario: Close button coexists with tap-outside-to-close

- **WHEN** a modal bottom sheet is open
- **THEN** both the explicit close button and the map-background tap gesture are available to dismiss it
