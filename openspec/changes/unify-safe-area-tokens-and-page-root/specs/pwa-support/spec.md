## MODIFIED Requirements

### Requirement: Interactive controls stay clear of bottom safe-area

Action bars, floating action buttons, bottom sheets, and any future bottom navigation SHALL apply the bottom safe-area inset via `var(--safe-bottom)` (on `padding-bottom` or `bottom`) so their touch targets sit fully above the Android gesture bar and the iOS home indicator. Non-interactive layers (map canvas, page background image) SHALL still extend behind the safe-area. The raw `env(safe-area-inset-bottom)` value SHALL be sourced only through the `--safe-bottom` token (defined in `safe-area.css`), not inline at the call site.

#### Scenario: Android PWA map action bar

- **WHEN** the user views the map on Android with gesture navigation enabled
- **THEN** the map action bar's buttons sit above the gesture bar and remain fully tappable

#### Scenario: iOS PWA bottom sheet

- **WHEN** a tour info bottom sheet is open on iOS PWA
- **THEN** its bottom-most interactive control is positioned above the home indicator

#### Scenario: Inset sourced from token

- **WHEN** an interactive control's CSS sets its bottom safe-area clearance
- **THEN** it references `var(--safe-bottom)` and contains no inline `env(safe-area-inset-bottom)`
