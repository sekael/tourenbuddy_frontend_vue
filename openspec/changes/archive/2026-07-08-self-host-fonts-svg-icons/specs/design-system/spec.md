## MODIFIED Requirements

### Requirement: Inter font typography

The system SHALL bundle the Inter font (weights 400, 500, 600) as self-hosted assets, precached by the service worker, with no dependency on an external font CDN. The `--font-family-base` token SHALL use `'Inter'` as the primary font with system fonts as fallback. Heading weights SHALL use `--font-weight-medium` (500) instead of bold (700) for a sleeker appearance.

#### Scenario: Inter font loads from bundle

- **WHEN** the app loads
- **THEN** text renders in the Inter font family served from the app's own bundle, without any request to a third-party font origin

#### Scenario: Inter available offline

- **WHEN** the app is opened offline
- **THEN** text still renders in Inter from the precached font assets

#### Scenario: Font fallback

- **WHEN** the bundled Inter font fails to load for any reason
- **THEN** text falls back to the system font stack

### Requirement: Material Symbols icon font

The system SHALL render icons as bundled SVGs (using the Material Symbols Outlined glyph set), tree-shaken at build time, with no dependency on an external font CDN. Icons SHALL be rendered through a shared `Icon` component that exposes the glyph name and token-driven sizing, backed by a central icon registry that maps each icon name to its SVG. An icon's rendered box SHALL be independent of any text content, so that font-load state, network conditions, or a missing asset can never let icon markup affect the layout of a containing element.

#### Scenario: Icon renders via the component

- **WHEN** a component renders `<Icon name="map" />`
- **THEN** the map icon renders as an inline SVG vector with the standard size

#### Scenario: Icon sizing is token-driven

- **WHEN** an `Icon` is rendered at a given size
- **THEN** its dimensions derive from design tokens rather than per-instance literal font sizes

#### Scenario: Dynamically named icon resolves

- **WHEN** a component passes an icon name chosen at runtime (e.g. from the tour-type lookup or a prop)
- **THEN** the shared component resolves it through the icon registry and renders the corresponding SVG

#### Scenario: Fixed-position icon bar keeps its intrinsic width at app start

- **WHEN** the tour action-bar pill mounts at app start under any network condition (slow, offline, cold PWA)
- **THEN** the pill sizes to its content (label + fixed-size icon boxes) and does not span the full viewport width, because the SVG icons have no text content that could widen it
