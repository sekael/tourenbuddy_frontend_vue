## ADDED Requirements

### Requirement: Language selector in profile

The user profile view SHALL include a single-select language control listing all supported locales from the i18n registry. Selecting a locale SHALL invoke `useLocaleStore().setLocale(code)` immediately, with no separate save step.

#### Scenario: Display supported locales

- **WHEN** the profile view is rendered
- **THEN** the language control SHALL display one option per supported locale, with the active locale pre-selected

#### Scenario: Selection applies immediately

- **WHEN** the user selects a different locale option
- **THEN** the system SHALL invoke `setLocale(code)` and the surrounding UI SHALL re-render in the new locale within the next reactive tick

#### Scenario: Choice persists across reload

- **WHEN** the user selects `de-CH` and then reloads the application
- **THEN** the language control SHALL show `de-CH` as the active selection on the next render

#### Scenario: Choice persists across sign-out

- **WHEN** the user selects `de-CH`, signs out, then signs in again on the same device
- **THEN** the active locale SHALL still be `de-CH`
