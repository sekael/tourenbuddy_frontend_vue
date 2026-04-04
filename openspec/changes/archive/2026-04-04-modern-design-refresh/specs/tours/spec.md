## MODIFIED Requirements

### Requirement: Tour creation dialog styling

The tour creation dialog SHALL use updated design tokens: `--color-surface` background, `--shadow-lg` layered shadow, 16px border-radius, and `--color-outline-variant` border. Input fields SHALL use the updated input styling conventions. The save button SHALL use primary button styling and cancel SHALL use secondary styling.

#### Scenario: Tour creation dialog renders with modern design

- **WHEN** user opens the tour creation dialog
- **THEN** the dialog displays with blueish-grey palette, layered shadow, and modern input/button styles

### Requirement: Tour info sheet design

The tour info sheet SHALL include a drag handle indicator at the top (small centered rounded bar). Detail rows SHALL use Material Symbols icons: `calendar_today` for date, `location_on` for coordinates, `group` for partners. The close button SHALL use Material Symbols `close` icon. The sheet SHALL have `--shadow-lg` and a subtle top border.

#### Scenario: Tour info sheet displays Material Symbols

- **WHEN** user views a tour info sheet
- **THEN** detail rows show Material Symbols icons instead of emoji

#### Scenario: Tour info sheet has drag handle

- **WHEN** the tour info sheet is visible
- **THEN** a small rounded drag handle bar is visible at the top of the sheet
