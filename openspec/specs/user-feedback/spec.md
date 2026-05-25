## Purpose

In-app feedback channel for users to report bugs and request features, delivered to maintainers.

## Requirements

### Requirement: Feedback entry point on the map screen

The map screen SHALL expose a Feedback entry point that lets a user open a sheet offering ways to send feedback to the team.

#### Scenario: Feedback FAB visible on map

- **WHEN** the map page is rendered and the user is not currently picking a location
- **THEN** a Feedback floating action button SHALL be visible in the map action overlay

#### Scenario: Tapping the feedback FAB opens the sheet

- **WHEN** the user taps the Feedback floating action button
- **THEN** the application SHALL display a Feedback sheet containing a primary "Open Issue on GitHub" action and a fallback hint pointing to the feedback email

### Requirement: GitHub issue template link

The Feedback sheet SHALL provide a primary action that opens the project's GitHub `bug_report.md` issue template in a new browser tab.

#### Scenario: Open issue link succeeds

- **WHEN** the user activates the "Open Issue on GitHub" action
- **THEN** the application SHALL open `https://github.com/sekael/tourenbuddy_frontend_vue/issues/new?template=bug_report.md` in a new tab with `noopener,noreferrer`
- **AND** the Feedback sheet SHALL close

#### Scenario: New tab blocked

- **WHEN** the user activates the "Open Issue on GitHub" action
- **AND** the browser blocks the new tab (e.g. popup blocker)
- **THEN** the application SHALL display an error snackbar instructing the user to use the email fallback

### Requirement: Email fallback always visible

The Feedback sheet SHALL always display the support email address `feedback@tourenbuddy.ch` as a fallback for users without a GitHub account.

#### Scenario: Email fallback rendered

- **WHEN** the Feedback sheet is open
- **THEN** the sheet SHALL render a `mailto:feedback@tourenbuddy.ch` link alongside the primary GitHub action

### Requirement: Centralized feedback configuration

The GitHub issue URL and feedback email used by the Feedback sheet SHALL be defined as constants in `src/core/constants/feedback.ts` and SHALL NOT be hardcoded inside Vue components.

#### Scenario: Constants module exposes values

- **WHEN** any component or test imports feedback configuration
- **THEN** it SHALL import `FEEDBACK_GITHUB_ISSUE_URL` and `FEEDBACK_EMAIL` from `@/core/constants/feedback`
