## MODIFIED Requirements

### Requirement: User profile sheet design

The user profile sheet SHALL include a drag handle indicator at the top. The close button SHALL use Material Symbols `close` icon. The sign-out button SHALL use Material Symbols `logout` icon alongside the text. The avatar circle SHALL use `--color-primary` background. The sheet SHALL use `--shadow-lg` and `--color-surface` background.

#### Scenario: Profile sheet displays Material Symbols

- **WHEN** user opens the profile sheet
- **THEN** the close button shows a `close` icon and sign-out button shows a `logout` icon

#### Scenario: Profile sheet has drag handle

- **WHEN** the profile sheet is visible
- **THEN** a small rounded drag handle bar is visible at the top of the sheet
