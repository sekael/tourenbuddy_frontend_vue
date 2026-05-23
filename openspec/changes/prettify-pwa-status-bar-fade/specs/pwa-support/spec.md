## ADDED Requirements

### Requirement: PWA pages extend content into safe-area zones

When installed as a PWA on iOS or Android, every routed page SHALL paint its own background (image, map canvas, or surface color) edge-to-edge of the device viewport, including beneath the top notch / status bar and the bottom home indicator / gesture bar. The body element SHALL NOT paint a brand-colored band in the safe-area.

#### Scenario: iOS PWA home page

- **WHEN** the user installs the app on iOS and opens the home page
- **THEN** the home page background image extends from the physical top edge to the physical bottom edge of the screen, with no solid blue band above it

#### Scenario: iOS PWA map view

- **WHEN** the user opens the map view in the installed iOS PWA
- **THEN** Swisstopo map tiles render under the notch and under the home indicator, with no solid color band

#### Scenario: Page mounted before content paints

- **WHEN** a route transition is in flight and a page root has not yet rendered its background
- **THEN** the visible fallback is the app's neutral surface color (not the legacy blue status-bar color)

### Requirement: Interactive controls stay clear of bottom safe-area

Action bars, floating action buttons, bottom sheets, and any future bottom navigation SHALL apply `padding-bottom: env(safe-area-inset-bottom)` (or equivalent margin) so their touch targets sit fully above the Android gesture bar and the iOS home indicator. Non-interactive layers (map canvas, page background image) SHALL still extend behind the safe-area.

#### Scenario: Android PWA map action bar

- **WHEN** the user views the map on Android with gesture navigation enabled
- **THEN** the map action bar's buttons sit above the gesture bar and remain fully tappable

#### Scenario: iOS PWA bottom sheet

- **WHEN** a tour info bottom sheet is open on iOS PWA
- **THEN** its bottom-most interactive control is positioned above the home indicator
