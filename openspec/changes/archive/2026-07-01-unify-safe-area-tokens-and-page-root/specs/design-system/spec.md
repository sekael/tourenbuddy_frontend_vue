## ADDED Requirements

### Requirement: Safe-area insets are consumed via tokens

Application code SHALL reference safe-area insets through the semantic tokens `var(--safe-top)`, `var(--safe-right)`, `var(--safe-bottom)`, and `var(--safe-left)`. Raw `env(safe-area-inset-*)` SHALL appear in exactly one place — `src/app/theme/safe-area.css`, where the tokens are defined — so a future floor (e.g. `max(env(...), 8px)`) can be introduced in one location. No component, page, or other theme file SHALL call `env(safe-area-inset-*)` inline.

#### Scenario: Component sources a bottom inset

- **WHEN** an overlay component needs to clear the bottom safe-area
- **THEN** its CSS references `var(--safe-bottom)`, not `env(safe-area-inset-bottom)`

#### Scenario: Tokens are the only env() site

- **WHEN** the codebase is grepped for `env(safe-area-inset` under `src/`
- **THEN** the only matches are the four token definitions in `src/app/theme/safe-area.css`

## MODIFIED Requirements

### Requirement: Full-viewport page root contract

Every routed page's root element SHALL size to the largest viewport (`min-height: 100lvh`, with `min-height: -webkit-fill-available` as a fallback for older iOS; fixed full-screen pages MAY use `height` instead of `min-height`) and SHALL own its visible background, so its `background-color` or full-bleed canvas/image fills the safe-area zones (box reaches the physical viewport edges, padding insets the content). The `body` element SHALL have `background: transparent` so the page root's background is what fills the safe-area zones. Safe-area insets on page roots and their inner content SHALL be sourced via the `var(--safe-*)` tokens, not inline `env(safe-area-inset-*)`. Inner content containers (headings, primary actions) SHALL be offset from the notch via `var(--safe-top)`; pages with a full-bleed hero/image/canvas SHALL let the full-bleed layer reach the physical edges and apply `var(--safe-*)` only to interactive/content chrome.

#### Scenario: Page root fills the viewport

- **WHEN** any routed page mounts
- **THEN** its root element occupies at least the full large-viewport height and its background paints the full viewport width including under safe-area insets

#### Scenario: Inner content respects the notch

- **WHEN** a page's content contains a primary heading or CTA near the top
- **THEN** that element is offset by at least `var(--safe-top)` from the physical top edge

#### Scenario: Full-bleed layer draws under safe areas

- **WHEN** a page with a full-bleed hero image or map canvas mounts in standalone PWA
- **THEN** the full-bleed layer reaches the physical edges while text/content/interactive chrome is offset by `var(--safe-*)` as needed

#### Scenario: Body is transparent

- **WHEN** any page is mounted
- **THEN** computed `background-color` on `body` resolves to `transparent` (or `rgba(0,0,0,0)`)

### Requirement: Safe-area handling lives on interactive overlays

The design system SHALL prescribe that the bottom safe-area inset is applied — via `var(--safe-bottom)` — to interactive overlay components (action bars, FABs, sheet handles, bottom navigation), NOT to full-bleed background layers (page roots, map canvas, hero images).

#### Scenario: Map canvas reaches the edge

- **WHEN** the map view renders
- **THEN** the MapLibre canvas extends to the bottom edge of the viewport with no padding for the home indicator

#### Scenario: Map action overlay is inset

- **WHEN** the map action bar renders on a device with a non-zero bottom safe-area inset
- **THEN** the action bar's bottom edge is offset from the viewport bottom by at least `var(--safe-bottom)`
