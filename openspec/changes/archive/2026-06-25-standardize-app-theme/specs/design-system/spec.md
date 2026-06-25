## ADDED Requirements

### Requirement: Two-tier token structure with overridable semantic layer

Design tokens SHALL be authored directly in CSS (`tokens.css`/`typography.css`) and organized in two tiers: a **primitive** tier (raw palette ramps, spacing scale, radius scale, font sizes/weights/line-heights, raw shadows — context-free values) and a **semantic** tier (e.g. `--color-surface`, `--color-on-surface`, `--color-primary`) whose values reference primitive tokens via `var()`. Application code SHALL reference semantic tokens; primitives SHALL be referenced only by semantic tokens. The semantic tier SHALL be defined such that an alternate theme (e.g. dark mode) can be introduced later by overriding only the semantic tier, without changing primitives or component code. Restructuring SHALL preserve current token values (no intended visual change).

#### Scenario: Semantic token resolves through a primitive

- **WHEN** a component uses `var(--color-surface)`
- **THEN** the semantic token resolves to a value defined by a primitive palette token, not a raw literal in the component

#### Scenario: Alternate theme overrides only the semantic tier

- **WHEN** a future theme variant is added
- **THEN** it can be expressed by reassigning semantic tokens to different primitives
- **AND** no component or primitive token needs to change

#### Scenario: Restructuring preserves values

- **WHEN** the tokens are restructured into two tiers
- **THEN** the resolved value of each existing semantic token is unchanged from before

### Requirement: Runtime CSS functions are not design tokens

Runtime/contextual CSS functions such as `env(safe-area-inset-*)` SHALL NOT live in the token files (`tokens.css`/`typography.css`). They SHALL be defined as hand-written custom properties in global CSS (e.g. `global.css`). The token files SHALL contain only static design values.

#### Scenario: Safe-area vars live in global CSS

- **WHEN** the theme files are inspected
- **THEN** `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right` are defined in global CSS, not in `tokens.css`
- **AND** `tokens.css` contains only static value tokens

### Requirement: Documented design-language source of truth

The repository SHALL contain a root `DESIGN.md` documenting the design language: palette, spacing/radius/font scales, shadows, typography, component anatomy, and usage rules. `DESIGN.md` SHALL describe structure, rules, and rationale and reference `tokens.css` as canonical for exact values rather than maintaining a second copy of every value. `DESIGN.md` SHALL state that any design work based on it must be supplemented with up-to-date screenshots captured at time of use (no screenshots are stored in the repo by this change).

#### Scenario: Design language is documented

- **WHEN** a contributor or design session needs the app's design language
- **THEN** `DESIGN.md` provides the palette, scales, typography, component anatomy, and usage rules
- **AND** it directs the reader to capture current screenshots at time of use

#### Scenario: No duplicated value source

- **WHEN** an exact token value is needed
- **THEN** `DESIGN.md` points to `tokens.css` as canonical rather than restating every value

### Requirement: Application components consume tokens and shared components

Application components SHALL reference design tokens (`var(--*)`) and shared base components instead of hardcoded values. Hardcoded color hex literals, literal `font-size` values, and literal `border-radius` values SHALL NOT appear in feature/page component styles where a corresponding token exists. Interactive action buttons SHALL use the shared `Button` component, icon-only buttons SHALL use the shared `IconButton` component, and icon glyphs SHALL use the shared `Icon` component. Tabs and segmented toggles, which are single-usage today, SHALL be styled from design tokens in place (not componentized in this change) and flagged in `DESIGN.md` for extraction at second usage.

#### Scenario: No hardcoded color in a migrated component

- **WHEN** a migrated component's styles are inspected
- **THEN** colors, font sizes, and radii are expressed via `var(--*)` tokens, not raw literals

#### Scenario: Buttons use the shared component

- **WHEN** a migrated component renders an interactive action button
- **THEN** it uses the `Button` component rather than a bespoke styled `<button>` element

#### Scenario: Icon-only buttons use the shared component

- **WHEN** a migrated component renders an icon-only button (e.g. close, back, dismiss)
- **THEN** it uses the `IconButton` component rather than a bespoke styled `<button>` element

### Requirement: Shared icon-only button component

The system SHALL provide a shared `IconButton` component for inline icon-only buttons (close, back, dismiss, inline icon actions). It SHALL render a single `Icon`, expose token-driven sizing, and forward native button attributes including `disabled` and an accessible label (`aria-label`/`title`). Its corner shape SHALL be prop/token-driven (default round, matching dominant existing usage; a square option available) so existing icon-only buttons migrate with no visual change. It is distinct from the circular floating `round-action-button` (FAB) by **role** — `IconButton` is inline and token-sized, the FAB is a fixed 52px floating control — and the FAB remains a separate component.

#### Scenario: Icon-only button renders accessibly

- **WHEN** an `IconButton` is rendered with an icon name and an accessible label
- **THEN** it shows the icon glyph at a token-driven size, with a prop/token-driven corner shape (default round), and exposes the label to assistive tech

#### Scenario: Disabled icon-only button blocks interaction

- **WHEN** an `IconButton` is `disabled`
- **THEN** it does not emit a click

## MODIFIED Requirements

### Requirement: Button styling conventions

The system SHALL provide a shared `Button` component as the standard way to render interactive action buttons (those with a text label). The component SHALL support **variants** (primary, secondary/ghost, danger, and text) and **sizes** (at minimum: small, medium, large), all driven by design tokens. Primary buttons SHALL have `--color-primary` background, white text, token-driven corners, and a subtle scale transform on hover. Secondary/ghost buttons SHALL have transparent background with a subtle border. Text buttons SHALL be borderless (transparent background, no border) for low-emphasis actions. Button dimensions, padding, and radius SHALL come from tokens, not per-instance literals. Full width is a layout concern handled at the call site (no `fullWidth` prop). Icon-only buttons are handled by `IconButton`; tabs and segmented toggles are out of scope and SHALL be tokenized in place (not componentized) this change.

#### Scenario: Primary button styling

- **WHEN** a primary `Button` is rendered
- **THEN** it has the primary background color, white text, token-driven radius, and a hover scale effect

#### Scenario: Variant and size are selectable

- **WHEN** a consumer renders `Button` with a chosen variant and size prop
- **THEN** the rendered button reflects the corresponding token-driven styling

#### Scenario: Ghost button styling

- **WHEN** a secondary/ghost `Button` is rendered
- **THEN** it has a transparent background and a subtle token-driven border

#### Scenario: Text button styling

- **WHEN** a `text` `Button` is rendered
- **THEN** it has a transparent background and no border (borderless, low-emphasis)

### Requirement: Material Symbols icon font

The system SHALL load Google Material Symbols Outlined from CDN in `index.html`. Icons SHALL be rendered through a shared `Icon` component that wraps the `material-symbols-outlined` span, exposing the glyph name and token-driven sizing/weight, so icon usage is consistent across the app.

#### Scenario: Icon renders via the component

- **WHEN** a component renders `<Icon name="map" />`
- **THEN** the map icon renders as a Material Symbols vector glyph with the standard size and weight

#### Scenario: Icon sizing is token-driven

- **WHEN** an `Icon` is rendered at a given size
- **THEN** its dimensions derive from design tokens rather than per-instance literal font sizes
