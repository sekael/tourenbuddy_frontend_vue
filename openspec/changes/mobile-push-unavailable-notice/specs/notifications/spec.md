## MODIFIED Requirements

### Requirement: iOS PWA gating
The system SHALL hide the push toggle when the client is iOS Safari and the app is not running in standalone (installed PWA) mode, and SHALL replace the toggle with a compact "unavailable" indicator that exposes the install-to-home-screen guidance via a tap- and hover-activated tooltip rather than rendering the guidance inline.

#### Scenario: iOS browser, not installed
- **WHEN** the user opens preferences in iOS Safari and `display-mode` is not `standalone`
- **THEN** the push toggle is hidden, a compact "Not available" badge with an info-icon button is shown in its place, and activating the info button reveals the install-to-home-screen guidance text

#### Scenario: iOS installed PWA
- **WHEN** the user opens preferences in an installed PWA on iOS 16.4+
- **THEN** the push toggle is shown and registration follows the standard Web Push flow

## ADDED Requirements

### Requirement: Compact unavailable indicator for push notifications
The notifications preferences UI SHALL present a single compact "unavailable" indicator in place of the push toggle whenever push notifications cannot be enabled on the current client — covering both the PWA-install-required case and the permission-denied case — and SHALL expose the full explanatory text only through an info-icon-triggered tooltip so the row remains single-line on mobile viewports across supported locales.

#### Scenario: Push permission denied
- **WHEN** the browser push permission state is `denied`
- **THEN** the push toggle is hidden and a compact "Not available" badge with an info-icon button is rendered in its place, the info button carries an accessible label equal to the full denial explanation, and activating it shows that explanation in a tooltip

#### Scenario: PWA install required
- **WHEN** push is supported by the browser but the app is not yet installed as a PWA
- **THEN** the push toggle is hidden and the same compact "Not available" badge + info-icon button is rendered, with the tooltip carrying the install-to-home-screen guidance

#### Scenario: Long-locale layout
- **WHEN** the active locale produces a long explanation string (e.g. German) and the viewport is narrow
- **THEN** the push row remains single-line because the long string lives inside the tooltip rather than inline in the row
