## MODIFIED Requirements

### Requirement: PWA pages extend content into safe-area zones

When installed as a PWA, every routed page SHALL paint its own background (image, map canvas, or surface color) edge-to-edge of the area the system gives the app, including beneath the bottom home indicator / gesture bar. On iOS the app SHALL use the default, opaque status bar in the theme color, with the page below it: a `black-translucent` status bar gets a system blur over the page's top edge since iOS 26.1. The body element SHALL NOT paint a brand-colored band in the safe-area.

#### Scenario: iOS PWA home page

- **WHEN** the user installs the app on iOS and opens the home page
- **THEN** the status bar is opaque in the theme color, the page starts below it with no blur over its top edge, and the background image extends to the physical bottom edge with no solid blue band

#### Scenario: iOS PWA map view

- **WHEN** the user opens the map view in the installed iOS PWA
- **THEN** Swisstopo map tiles render from directly below the status bar down under the home indicator, with no blur or color band over the map

#### Scenario: Page mounted before content paints

- **WHEN** a route transition is in flight and a page root has not yet rendered its background
- **THEN** the visible fallback is the app's neutral surface color (not the legacy blue status-bar color)

#### Scenario: Tour form header on iOS

- **WHEN** the user opens the new-tour form in the installed iOS PWA
- **THEN** the close button, title and Save button sit fully visible and sharp below the status bar
