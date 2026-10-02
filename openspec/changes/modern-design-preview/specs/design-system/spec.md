## ADDED Requirements

### Requirement: Selectable design variant

The system SHALL support two design variants: **Classic** (default) and **Alpenglow** (opt-in preview). The active variant SHALL be chosen per device, persisted across reloads and PWA restarts, and applied to the document before the app first renders. An unknown, missing, or unreadable stored value SHALL resolve to Classic.

#### Scenario: First launch uses Classic

- **WHEN** the app starts on a device with no stored design choice
- **THEN** the Classic variant is active

#### Scenario: Choice survives a restart

- **WHEN** the user selects Alpenglow and later reloads the app or relaunches the PWA
- **THEN** the Alpenglow variant is active on first render, with no flash of Classic

#### Scenario: Invalid stored value

- **WHEN** the stored design choice is not a known variant name
- **THEN** the Classic variant is active

#### Scenario: Storage unavailable

- **WHEN** persistent storage cannot be read or written (e.g. a private-browsing restriction)
- **THEN** the app still starts with the Classic variant and switching still works for the current session

### Requirement: Design variant switcher in the profile sheet

The profile sheet SHALL offer a control to switch between the design variants, with every option labelled in all supported locales and Alpenglow marked as a preview. The currently active variant SHALL be visibly selected. Switching SHALL take effect immediately, without a reload.

#### Scenario: Switching applies immediately

- **WHEN** the user taps the Alpenglow option in the profile sheet
- **THEN** the whole app re-renders in the Alpenglow design without reloading
- **AND** the Alpenglow option is shown as selected

#### Scenario: Labels are localized

- **WHEN** the app language is German (Switzerland)
- **THEN** the switcher's heading and option labels are shown in German

### Requirement: Design variants are expressed as token overrides

A design variant SHALL be expressed only as overrides of design tokens scoped to the active variant. Component styles SHALL NOT branch on the active variant. Every token introduced for variants SHALL either have a Classic value equal to the value it replaced, or be left undefined in Classic so each consumer's fallback is its previous value — so Classic looks as it did before variants were introduced.

#### Scenario: Component styles are variant-agnostic

- **WHEN** component styles are inspected
- **THEN** no selector targets a specific design variant

#### Scenario: Classic is unchanged

- **WHEN** the Classic variant is active
- **THEN** shared buttons, FABs, sheets, dialogs, drawers, and snackbars render with the same colors, radii, shadows, durations, and easings as before this change

### Requirement: Alpenglow design variant

The Alpenglow variant SHALL use a blue brand primary with brand-tinted surface variants, larger corner radii, pill-shaped action buttons, softer brand-tinted shadows, a deep navy map-overlay and inverse surface, springy easing for small overlays, and press-down feedback on shared buttons and FABs. Text on the primary color SHALL meet WCAG AA contrast (≥ 4.5:1).

#### Scenario: Brand primary

- **WHEN** Alpenglow is active and a primary `Button` is rendered
- **THEN** it has a blue background, white text with at least 4.5:1 contrast, and fully rounded (pill) corners

#### Scenario: Tactile press feedback

- **WHEN** Alpenglow is active and the user presses a shared button or FAB
- **THEN** the control scales down slightly while pressed and returns when released

### Requirement: Alpenglow element styling is consistent across the app

In the Alpenglow variant each recurring UI element SHALL have exactly one treatment wherever it appears: action buttons (by variant), overlay chrome (sheet, dialog, drawer, full-screen page), section headings, field labels, text inputs, selectable chips/options, tabs, and dividers. The treatment SHALL come from component tokens shared by every instance of that element.

#### Scenario: One selected-chip style

- **WHEN** Alpenglow is active and a tour-type chip, a tour filter chip, a contact chip, and a profile language option are each selected
- **THEN** all four show the same pill shape, tinted fill, border, and text color

#### Scenario: One section-heading style

- **WHEN** Alpenglow is active and the profile sheet, contact detail view, tour form, and friend requests sheet render section headings
- **THEN** all headings share the same size, weight, case, letter-spacing, and color

#### Scenario: Overlay chrome matches across overlay types

- **WHEN** Alpenglow is active and a bottom sheet, a dialog, a side drawer, and a full-screen page are opened
- **THEN** their titles share one size and tracking, their close buttons share one tonal style, and none shows a header divider line

#### Scenario: Secondary actions are tonal

- **WHEN** Alpenglow is active and a secondary, primary-outline, or danger-outline `Button` is rendered
- **THEN** it has a tinted fill and no outline border

#### Scenario: Input focus is visible

- **WHEN** Alpenglow is active and a text input receives focus
- **THEN** it shows a primary-colored border and a surrounding focus ring

### Requirement: Navigation and tab changes animate smoothly

In the Alpenglow variant, switching tabs SHALL slide the active-tab indicator to the chosen tab and move the tab content in the same direction; replacing one sheet with another SHALL cross-fade with a short lift instead of sliding the first sheet off-screen and the second back up; moving between views inside a sheet SHALL slide forward or back. In Classic these changes SHALL remain instant, as before.

#### Scenario: Switching own and friend tours

- **WHEN** Alpenglow is active and the user switches from My Tours to Friends
- **THEN** the active-tab pill slides to Friends and the list slides out toward the left while the friend list slides in from the right

#### Scenario: Opening a tour from the tour list

- **WHEN** Alpenglow is active and the user taps a tour in the tour list
- **THEN** the list sheet fades out and the tour sheet fades in with a short lift, without either sheet leaving the screen

#### Scenario: Classic stays instant

- **WHEN** Classic is active and the user switches tabs or opens a tour from the list
- **THEN** the tab content swaps without animation and the sheets slide exactly as before

#### Scenario: Reduced motion

- **WHEN** the operating system requests reduced motion
- **THEN** the tab indicator moves without overshoot

### Requirement: Views carry no redundant chrome or dead space

Every overlay view SHALL have exactly one header row holding its title, back, actions, and close. List rows SHALL show the information users scan for: tour rows SHALL show the planned date when one is set. Equivalent primary actions in page headers SHALL share one size. These apply to every design variant.

#### Scenario: Contact detail has one header

- **WHEN** the user opens a contact from the contacts list
- **THEN** a single header shows back, the contact's name, Edit, and close, with no second header row inside the view

#### Scenario: Tour rows show the date

- **WHEN** a tour with a planned date is listed
- **THEN** its row shows the date (with the year only when it is not the current year) next to any partner names

#### Scenario: Undated tours stay compact

- **WHEN** a tour has neither a planned date nor partners
- **THEN** its row is a single line

### Requirement: Map controls are legible and stand out from the map

Floating map controls (menu trigger and items, compass, action bar, base-map options, persistent status chips, guided-tour banner) SHALL render their labels and icons with at least 4.5:1 contrast against the control surface, including the surface's translucency over a white map, and SHALL remain visually separated from the map background. Indicators on a control (notification dot, count badge) SHALL contrast with the control.

#### Scenario: Labels over a bright map

- **WHEN** Alpenglow is active and the speed-dial menu is open over a white map area
- **THEN** every item label reads at ≥ 4.5:1 and the controls are distinct from the map

#### Scenario: Guided-tour finish button

- **WHEN** the guided tour banner is shown in any variant
- **THEN** the "finish tour" label reads at ≥ 4.5:1 against the button behind it

### Requirement: Text meets WCAG AA contrast

All text SHALL meet WCAG 2.2 AA contrast (4.5:1, or 3:1 for large text) in every variant, including text on tinted fills, success and warning messages, hints, and status badges. Form controls SHALL have accessible names, and links SHALL be distinguishable from surrounding text by more than color.

#### Scenario: Status text on a tint

- **WHEN** a completed tour's completion toggle is shown (success text on a success tint or hover fill)
- **THEN** its label reads at ≥ 4.5:1

#### Scenario: Automated audit

- **WHEN** an axe-core WCAG 2.2 A/AA audit runs on the main screens in either variant
- **THEN** it reports no violations

### Requirement: No unnecessary motion

Interface changes SHALL move only what the user acted on. A desktop dialog whose content switches views or tabs SHALL keep one size. Options opened from a menu item SHALL appear at that item rather than after the menu collapses into its trigger.

#### Scenario: Friend requests and blocked users on desktop

- **WHEN** the user switches between the friend-requests and blocked tabs in the desktop dialog
- **THEN** the dialog keeps the same size

#### Scenario: Changing the base map

- **WHEN** the user taps "Change base map" in the open menu
- **THEN** the base-map options appear at that item's position while the other items fade in place, without the menu collapsing first

### Requirement: Motion and interaction tokens

The system SHALL define motion tokens (durations and easing curves) and interaction tokens (hover and press scale) in the semantic tier. Shared buttons, FABs, bottom-sheet slide-in, dialogs, drawers, and snackbars SHALL take their durations, easings, and scale effects from these tokens. When the user prefers reduced motion, overshooting easing and press scaling SHALL be disabled in every variant.

#### Scenario: Motion follows the active variant

- **WHEN** the active variant changes the easing token
- **THEN** sheet, dialog, and snackbar animations use the new easing without component changes

#### Scenario: Reduced motion

- **WHEN** the operating system requests reduced motion
- **THEN** no overshooting ("spring") easing is used and pressed controls do not scale

### Requirement: PWA theme color matches the app background

The browser/PWA theme color declared in the HTML document and in the web app manifest SHALL equal the app background color shared by all design variants, so the browser chrome and task switcher never show a color absent from the app.

#### Scenario: Installed PWA chrome

- **WHEN** the installed PWA is shown in the OS task switcher or with a colored title bar
- **THEN** the chrome color is the app background color, not a legacy brand color

## MODIFIED Requirements

### Requirement: Button styling conventions

The system SHALL provide a shared `Button` component as the standard way to render interactive action buttons (those with a text label). The component SHALL support **variants** (primary, secondary/ghost, danger, and text) and **sizes** (at minimum: small, medium, large), all driven by design tokens. Primary buttons SHALL have `--color-primary` background, white text, token-driven corners, and token-driven hover and press scale feedback. Secondary/ghost buttons SHALL have transparent background with a subtle border. Text buttons SHALL be borderless (transparent background, no border) for low-emphasis actions. Button dimensions, padding, radius, and interaction feedback SHALL come from tokens, not per-instance literals. Full width is a layout concern handled at the call site (no `fullWidth` prop). Icon-only buttons are handled by `IconButton`; tabs and segmented toggles are out of scope and SHALL be tokenized in place (not componentized) this change.

#### Scenario: Primary button styling

- **WHEN** a primary `Button` is rendered
- **THEN** it has the primary background color, white text, token-driven radius, and token-driven hover and press scale effects

#### Scenario: Variant and size are selectable

- **WHEN** a consumer renders `Button` with a chosen variant and size prop
- **THEN** the rendered button reflects the corresponding token-driven styling

#### Scenario: Ghost button styling

- **WHEN** a secondary/ghost `Button` is rendered
- **THEN** it has a transparent background and a subtle token-driven border

#### Scenario: Text button styling

- **WHEN** a `text` `Button` is rendered
- **THEN** it has a transparent background and no border (borderless, low-emphasis)

#### Scenario: Press feedback

- **WHEN** an enabled `Button` is pressed
- **THEN** it scales by the active variant's press-scale token (1 = no visible change in Classic)

### Requirement: Two-tier token structure with overridable semantic layer

Design tokens SHALL be authored directly in CSS (`tokens.css`/`typography.css`) and organized in two tiers: a **primitive** tier (raw palette ramps, spacing scale, radius scale, font sizes/weights/line-heights, raw shadows — context-free values) and a **semantic** tier (e.g. `--color-surface`, `--color-on-surface`, `--color-primary`) whose values reference primitive tokens via `var()`. Application code SHALL reference semantic tokens; primitive palette colors SHALL be referenced only by semantic tokens. An alternate theme or design variant SHALL be expressed by overriding the semantic tier; a design variant MAY additionally retune the radius and shadow scales (which components consume directly), but SHALL NOT change palette primitives, spacing, or typography scales. Restructuring SHALL preserve current token values (no intended visual change).

#### Scenario: Semantic token resolves through a primitive

- **WHEN** a component uses `var(--color-surface)`
- **THEN** the semantic token resolves to a value defined by a primitive palette token, not a raw literal in the component

#### Scenario: Alternate theme overrides only the semantic tier

- **WHEN** a theme or design variant is added
- **THEN** it can be expressed by reassigning semantic tokens to different primitives (and, for a design variant, retuning radius/shadow scales)
- **AND** no component or palette primitive needs to change

#### Scenario: Restructuring preserves values

- **WHEN** the tokens are restructured into two tiers
- **THEN** the resolved value of each existing semantic token is unchanged from before
