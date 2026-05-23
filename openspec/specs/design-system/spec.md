## ADDED Requirements

### Requirement: Blueish-grey color palette tokens

The system SHALL define CSS custom properties for a blueish-grey (slate) color palette in `tokens.css`. The palette SHALL include primary (#475569), primary-light (#64748b), primary-dark (#334155), surface (#f8fafc), on-surface (#0f172a), surface-variant (#e2e8f0), background (#ffffff), outline (#94a3b8), outline-variant (#cbd5e1), error (#dc2626), error-container (#fef2f2), and corresponding on-\* text colors. An accent color (#3b82f6) SHALL be added for interactive highlights.

#### Scenario: Color tokens are available

- **WHEN** any component references `var(--color-primary)`
- **THEN** it resolves to the slate blue value `#475569`

#### Scenario: Accent color is available

- **WHEN** a component references `var(--color-accent)`
- **THEN** it resolves to `#3b82f6`

### Requirement: Inter font typography

The system SHALL load the Inter font (weights 400, 500, 600) from Google Fonts CDN. The `--font-family-base` token SHALL use `'Inter'` as the primary font with system fonts as fallback. Heading weights SHALL use `--font-weight-medium` (500) instead of bold (700) for a sleeker appearance.

#### Scenario: Inter font loads

- **WHEN** the app loads in a browser with network access
- **THEN** text renders in Inter font family

#### Scenario: Font fallback

- **WHEN** Google Fonts CDN is unreachable
- **THEN** text falls back to the system font stack

### Requirement: Material Symbols icon font

The system SHALL load Google Material Symbols Outlined from CDN in `index.html`. Icons SHALL be rendered using `<span class="material-symbols-outlined">icon_name</span>` syntax throughout the application.

#### Scenario: Material icons render

- **WHEN** a component includes `<span class="material-symbols-outlined">map</span>`
- **THEN** the map icon renders as a vector glyph

### Requirement: Layered shadow tokens

The system SHALL define CSS custom properties for layered soft shadows: `--shadow-sm`, `--shadow-md`, and `--shadow-lg`. Shadows SHALL use multiple layers for a natural depth effect.

#### Scenario: Shadow tokens are available

- **WHEN** a component references `var(--shadow-md)`
- **THEN** it resolves to a multi-layer shadow value

### Requirement: Glassmorphism utility styles

The system SHALL define a glassmorphism style pattern using `backdrop-filter: blur()` with semi-transparent backgrounds. This pattern SHALL only be applied to map overlay components.

#### Scenario: Glass effect on map controls

- **WHEN** a map overlay component uses the glass style
- **THEN** the background is semi-transparent with a blur effect behind it

### Requirement: Button styling conventions

Primary buttons SHALL have `--color-primary` background, white text, 12px border-radius, and a subtle scale transform on hover. Secondary/ghost buttons SHALL have transparent background with a subtle border.

#### Scenario: Primary button styling

- **WHEN** a primary button is rendered
- **THEN** it has the primary background color, white text, 12px radius, and hover scale effect

### Requirement: Input field styling conventions

Input fields SHALL have a clean border style with `--color-outline-variant` border, 8px border-radius, and a smooth focus transition that highlights the border in `--color-primary`.

#### Scenario: Input focus transition

- **WHEN** an input field receives focus
- **THEN** the border color transitions smoothly to `--color-primary`

### Requirement: Consistent modal bottom sheet contract

All modal bottom sheet components in the application SHALL follow a consistent contract: they SHALL accept an `open` (or `modelValue`) boolean prop, emit a `close` event when dismissed, and support backdrop-click dismissal from their parent container.

#### Scenario: Sheet accepts open prop

- **WHEN** a parent renders a bottom sheet component with `:open="true"`
- **THEN** the sheet SHALL be visible

#### Scenario: Sheet emits close on dismiss

- **WHEN** the user triggers a dismiss action (close button, backdrop click, or Escape key)
- **THEN** the sheet component SHALL emit a `close` event
- **AND** the parent SHALL be responsible for updating the controlling state

#### Scenario: Sheet does not own its own visibility

- **WHEN** a sheet component receives `:open="false"`
- **THEN** the sheet SHALL not render or be hidden
- **AND** the sheet SHALL NOT toggle its own visibility internally

#### Scenario: Backdrop provided by parent

- **WHEN** a sheet is open
- **THEN** the map page (or parent container) SHALL render a full-screen transparent backdrop element behind the sheet
- **AND** the backdrop SHALL forward click events to the sheet's close handler

#### Scenario: All existing sheets conform to contract

- **WHEN** `UserProfileSheet`, `ContactCreationSheet`, `FeedbackSheet`, and `TourInfoSheet` are reviewed
- **THEN** each SHALL expose an `open`/`modelValue` prop and a `close` emit consistent with this contract

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
