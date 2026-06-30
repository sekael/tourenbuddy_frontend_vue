## Purpose

Shared visual language: design tokens (spacing, radius, shadows, colors), typography, iconography, and base component styling.

## Requirements

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

The system SHALL load Google Material Symbols Outlined from CDN in `index.html`. Icons SHALL be rendered through a shared `Icon` component that wraps the `material-symbols-outlined` span, exposing the glyph name and token-driven sizing/weight, so icon usage is consistent across the app.

#### Scenario: Icon renders via the component

- **WHEN** a component renders `<Icon name="map" />`
- **THEN** the map icon renders as a Material Symbols vector glyph with the standard size and weight

#### Scenario: Icon sizing is token-driven

- **WHEN** an `Icon` is rendered at a given size
- **THEN** its dimensions derive from design tokens rather than per-instance literal font sizes

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

### Requirement: Documented exceptions to shared button components

The shared `Button` and `IconButton` components are the default for interactive controls. The system SHALL nonetheless permit the following controls to remain bespoke because they fill a **role** the shared components do not model. Each exception below is intentional and SHALL be treated as conformant; controls NOT listed here SHALL use the shared components.

- **Map overlay controls** — the speed-dial menu (`map-speed-dial-menu`, `speed-dial-*`), base-map picker (`base-map-picker`), base-map panel (`map-base-map-panel`), the compass-reset FAB (`map-action-overlay`), and the location-picker's translucent Cancel control (`location-picker`). Like `round-action-button`, these are floating map overlays styled with the glassmorphism surface tokens (`--color-fab-*`, backdrop blur) rather than the on-surface `Button`/`IconButton` palette so they stay legible over busy map tiles. They differ by role, not by accident. (The picker's Continue action sits in the same overlay but reads fine as a solid `Button` primary, so it is **not** exempt.)
- **Persistent tour action bar** — `tour-action-bar` is a segmented pill overlay defined by its own capability spec (see `tour-action-bar`); it is not a `Button`/`IconButton` consumer.
- **Media tiles & viewer controls** — the icon controls and white-on-scrim colors in `tour-attachment-viewer` sit over arbitrary dark media and require overlay-specific contrast; the attachment thumbnail tiles (`tour-attachments-strip`) are image/PDF previews, not labelled actions. Both are media affordances, not `Button`/`IconButton` consumers.
- **Selector / toggle controls** — controls whose role is selection state rather than a discrete action MAY remain bespoke; they are not action buttons. Examples: the primary-phone star (`contact-form`, `contact-detail-view`), the add-method phone/email type selector (`contact-detail-view`), the language selector (`user-profile-sheet`), the tour completion / visibility toggles (`tour-info-sheet`), and the multi-select filter chips (`tour-form`, `tour-filters-panel`).
- **Chips & compact pills** — pill-shaped labels (`contact-chip`, the linked-tour pills and `full-row` navigation list in `linked-with-section`, the friend-partner chips in `tour-info-sheet`) are a distinct compact affordance the design system does not yet model as a base component. Like tabs, they are tokenized in place and SHALL be extracted into a shared `Chip` component at the next demand rather than forced into `Button` (which would make them read as rectangular buttons).
- **Snackbar inline dismiss** — `error-snackbar`'s dismiss is rendered against the snackbar's own colored surface and stays bespoke.

#### Scenario: Map overlay control stays bespoke

- **WHEN** a floating map overlay control (speed dial, base-map picker/panel) is rendered
- **THEN** it uses glassmorphism overlay tokens and is exempt from the `Button`/`IconButton` requirement

#### Scenario: New control defaults to a shared component

- **WHEN** a new interactive control is added that is not a documented exception above
- **THEN** it uses `Button` (with a text label) or `IconButton` (icon-only)
