## ADDED Requirements

### Requirement: Full-viewport page root contract

Every routed page's root element SHALL size to the dynamic viewport (`min-height: 100dvh`, with `min-height: -webkit-fill-available` as a fallback for older iOS) and SHALL own its visible background. The `body` element SHALL have `background: transparent` so the page root's background is what fills the safe-area zones. Inner content containers (headings, primary actions) SHALL apply `padding-top: env(safe-area-inset-top)` so they remain visible below the notch.

#### Scenario: Page root fills the viewport

- **WHEN** any routed page mounts
- **THEN** its root element occupies at least the full dynamic viewport height and its background paints the full viewport width including under safe-area insets

#### Scenario: Inner content respects the notch

- **WHEN** a page's content contains a primary heading or CTA near the top
- **THEN** that element is offset by at least `env(safe-area-inset-top)` from the physical top edge

#### Scenario: Body is transparent

- **WHEN** any page is mounted
- **THEN** computed `background-color` on `body` resolves to `transparent` (or `rgba(0,0,0,0)`)

### Requirement: Safe-area handling lives on interactive overlays

The design system SHALL prescribe that `env(safe-area-inset-bottom)` is applied to interactive overlay components (action bars, FABs, sheet handles, bottom navigation), NOT to full-bleed background layers (page roots, map canvas, hero images).

#### Scenario: Map canvas reaches the edge

- **WHEN** the map view renders
- **THEN** the MapLibre canvas extends to the bottom edge of the viewport with no padding for the home indicator

#### Scenario: Map action overlay is inset

- **WHEN** the map action bar renders on a device with a non-zero bottom safe-area inset
- **THEN** the action bar's bottom edge is offset from the viewport bottom by at least `env(safe-area-inset-bottom)`

