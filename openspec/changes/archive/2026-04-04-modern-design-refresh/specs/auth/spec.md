## MODIFIED Requirements

### Requirement: Home page layout

The home page SHALL display the app title "TouringBuddy" and subtitle centered vertically with generous whitespace. The title SHALL use `--color-primary` and the "Get Started" button SHALL use primary button styling with 12px border-radius. The page background SHALL be `--color-background` with a clean, minimal aesthetic.

#### Scenario: Home page renders with updated design

- **WHEN** user navigates to the home page
- **THEN** the page displays with the blueish-grey color scheme, Inter font, and modern button styling

### Requirement: Email entry page layout

The email entry page SHALL display a back button using Material Symbols `arrow_back` icon, a title, email input with updated input styling, and submit button with primary button styling. Error messages SHALL use `--color-error`.

#### Scenario: Email page renders with Material icons

- **WHEN** user navigates to the email entry page
- **THEN** the back button displays an `arrow_back` Material Symbol instead of a text arrow

### Requirement: OTP verification page layout

The verify OTP page SHALL display a back button with Material Symbols `arrow_back` icon, title, OTP input field with updated styling, and verify/resend buttons. Success and error messages SHALL use the updated color tokens.

#### Scenario: OTP page renders with updated design

- **WHEN** user navigates to the OTP verification page
- **THEN** the page uses Material Symbols for navigation and updated color/typography tokens
