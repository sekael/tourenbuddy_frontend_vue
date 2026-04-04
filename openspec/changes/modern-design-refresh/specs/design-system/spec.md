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
