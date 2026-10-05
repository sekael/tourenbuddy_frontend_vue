## ADDED Requirements

### Requirement: Modern visual design language

The app SHALL use one visual design: a blue brand primary with brand-tinted surface variants, generous corner radii, pill-shaped action buttons, soft brand-tinted shadows, calm motion, and press-down feedback on every shared button, FAB, and map control. There SHALL be no runtime switch between designs. Text on the primary color SHALL meet WCAG AA contrast (≥ 4.5:1).

#### Scenario: Brand primary

- **WHEN** a primary `Button` is rendered
- **THEN** it has a blue background, white text with at least 4.5:1 contrast, and fully rounded (pill) corners

#### Scenario: Tactile press feedback

- **WHEN** the user presses a shared button, FAB, or map control
- **THEN** the control scales down slightly while pressed and returns when released

#### Scenario: No design switcher

- **WHEN** the profile sheet is opened
- **THEN** it offers no design or theme choice

### Requirement: Element styling is consistent across the app

Each recurring UI element SHALL have exactly one treatment wherever it appears: action buttons (by variant), overlay chrome (sheet, dialog, drawer, full-screen page), section headings, field labels, text inputs, selectable chips/options, tabs and segmented switches, and dividers. The treatment SHALL come from shared component tokens or a shared global rule used by every instance of that element.

#### Scenario: One selected-chip style

- **WHEN** a tour-type chip, a tour filter chip, a contact chip, and a profile language option are each selected
- **THEN** all four show the same pill shape, tinted fill, border, and text color

#### Scenario: One section-heading style

- **WHEN** the profile sheet, contact detail view, tour form, and friend requests sheet render section headings and field labels
- **THEN** all headings share the same size, weight, sentence case, letter-spacing, and color

#### Scenario: Overlay chrome matches across overlay types

- **WHEN** a bottom sheet, a dialog, a side drawer, a full-screen page, and the calendar page are opened
- **THEN** their titles share one size and tracking, their close/back buttons share one tonal style, and none shows a header divider line

#### Scenario: One tab style

- **WHEN** the tours tabs, the friend-request tabs, a help tab row, and the tour-filter status switch are shown
- **THEN** all render as the same segmented control: tonal track, equal-width options, and a white pill under the selected option

#### Scenario: Input focus is visible

- **WHEN** a text input receives focus
- **THEN** it shows a primary-colored border and a surrounding focus ring

### Requirement: Tonal controls stand out from their surface

Secondary actions and navigation chrome SHALL be tonal: a filled control container one step stronger than the tinted surface used for cards and hovered rows, with a label of at least 4.5:1 on the fill and on its hover fill. Secondary, primary-outline, and danger-outline `Button`s, close/back `IconButton`s, tab tracks, and navigation indicators SHALL use it, so they separate visibly from a white sheet, from a tinted card, and — with an added shadow — from the map.

#### Scenario: Secondary button on a sheet

- **WHEN** a secondary `Button` is rendered on a white sheet or inside a tinted card
- **THEN** its fill is visibly distinct from the surface behind it and its label reads at ≥ 4.5:1

#### Scenario: Secondary button over the map

- **WHEN** the location picker or region drawing shows its Cancel action over the map
- **THEN** it is the shared tonal `Button` with a shadow that lifts it off the terrain

#### Scenario: Toggle at rest

- **WHEN** a tour's completion and visibility toggles are in their default state (not completed, visible to friends)
- **THEN** both use the tonal container; only a completed or private state takes its own tint

### Requirement: Expanding map menus are consistent

Every menu that expands from a map control (the speed-dial menu and the base-map options) SHALL render each entry as the same glass pill holding its label and icon, with the icons aligned on the trigger's axis. Entries SHALL unfold one after another from where the menu was opened — rising from the trigger nearest first, or dropping from the item that opened them top first — and SHALL close with a single fade. In landscape on short screens the entries SHALL become icon-only circles on a quarter-circle arc around the trigger that never overlap each other or the trigger.

#### Scenario: Opening the speed dial

- **WHEN** the user taps the menu trigger
- **THEN** each entry appears as a glass pill (label, then icon) and the entries rise into place one after another, nearest the trigger first

#### Scenario: Base-map options match the menu

- **WHEN** the user opens the base-map options
- **THEN** each option is the same pill as a menu entry, the current base map is marked checked (darker fill and a check icon), and the options drop into place top first

#### Scenario: Landscape arc

- **WHEN** the speed dial opens in landscape on a short screen
- **THEN** all entries sit on an arc around the trigger without overlapping each other or the trigger

### Requirement: Navigation and tab changes animate smoothly

Switching tabs SHALL glide the selected-tab pill to the chosen tab and move the tab content in the same direction; replacing one sheet with another SHALL cross-fade with a short lift instead of sliding the first sheet off-screen and the second back up; moving between views inside a sheet SHALL slide forward or back.

#### Scenario: Switching own and friend tours

- **WHEN** the user switches from My Tours to Friends
- **THEN** the selected-tab pill glides to Friends and the list slides out toward the left while the friend list slides in from the right

#### Scenario: Opening a tour from the tour list

- **WHEN** the user taps a tour in the tour list
- **THEN** the list sheet fades out and the tour sheet fades in with a short lift, without either sheet leaving the screen

#### Scenario: Reduced motion

- **WHEN** the operating system requests reduced motion
- **THEN** nothing overshoots and swaps become plain fades without travel

### Requirement: Views carry no redundant chrome or dead space

Every overlay view SHALL have exactly one header row holding its title, back, actions, and close. List rows SHALL show the information users scan for: tour rows SHALL show the planned date when one is set. Equivalent primary actions in page headers SHALL share one size. Scrolling content above a sheet footer SHALL fade out under it rather than being cut off at its edge.

#### Scenario: Contact detail has one header

- **WHEN** the user opens a contact from the contacts list
- **THEN** a single header shows back, the contact's name, Edit, and close, with no second header row inside the view

#### Scenario: Tour rows show the date

- **WHEN** a tour with a planned date is listed
- **THEN** its row shows the date (with the year only when it is not the current year) next to any partner names

#### Scenario: Undated tours stay compact

- **WHEN** a tour has neither a planned date nor partners
- **THEN** its row is a single line

#### Scenario: Content under a footer

- **WHEN** a sheet with footer actions has more content than fits
- **THEN** the content fades out just above the footer instead of ending in a hard cut

### Requirement: Map controls are legible and stand out from the map

Floating map controls (menu trigger and items, compass, action bar, base-map options, persistent status chips, guided-tour banner) SHALL share one glass surface and render their labels and icons with at least 4.5:1 contrast against it, including the surface's translucency over a white map, and SHALL remain visually separated from the map background. Indicators on a control (notification dot, count badge) SHALL contrast with the control.

#### Scenario: Labels over a bright map

- **WHEN** the speed-dial menu is open over a white map area
- **THEN** every item label reads at ≥ 4.5:1 and the controls are distinct from the map

#### Scenario: Guided-tour finish button

- **WHEN** the guided tour banner is shown
- **THEN** the "finish tour" label reads at ≥ 4.5:1 against the button behind it

### Requirement: Text meets WCAG AA contrast

All text SHALL meet WCAG 2.2 AA contrast (4.5:1, or 3:1 for large text), including text on tinted fills and their hover fills, success, warning, and error messages, hints, and status badges. Form controls — toggle switches included — SHALL have accessible names, and links SHALL be distinguishable from surrounding text by more than color.

#### Scenario: Status text on a tint

- **WHEN** a completed tour's completion toggle is shown (success text on a success tint or hover fill)
- **THEN** its label reads at ≥ 4.5:1

#### Scenario: Toggle switches are named

- **WHEN** the notification preferences are shown
- **THEN** every switch exposes the name of the setting it controls

#### Scenario: Automated audit

- **WHEN** an axe-core WCAG 2.2 A/AA audit runs on the main screens
- **THEN** it reports no violations

### Requirement: No unnecessary motion

Interface changes SHALL move only what the user acted on. A desktop dialog whose content switches views or tabs SHALL keep one size. Options opened from a menu item SHALL appear at that item rather than after the menu collapses into its trigger. Controls SHALL NOT lift or scale on hover.

#### Scenario: Friend requests and blocked users on desktop

- **WHEN** the user switches between the friend-requests and blocked tabs in the desktop dialog
- **THEN** the dialog keeps the same size

#### Scenario: Changing the base map

- **WHEN** the user taps "Change base map" in the open menu
- **THEN** the base-map options appear at that item's position while the other items fade in place, without the menu collapsing first

### Requirement: Motion and interaction tokens

The system SHALL define motion tokens (durations, easing curves, and a glide offset) and a press-scale token in the semantic tier. Every transition and animation in the app — shared buttons, FABs, map controls, sheets, dialogs, drawers, snackbars, tabs, and view swaps — SHALL take its duration, easing, travel, and scale from these tokens rather than literals. When the user prefers reduced motion, overshooting easing, press scaling, and glide travel SHALL be disabled.

#### Scenario: Motion is retuned in one place

- **WHEN** an easing or duration token changes
- **THEN** sheet, dialog, menu, and snackbar animations use the new value without component changes

#### Scenario: Reduced motion

- **WHEN** the operating system requests reduced motion
- **THEN** no overshooting ("spring") easing is used, pressed controls do not scale, and swaps and menus fade without travel

### Requirement: Design tokens are always defined

Every custom property referenced without a fallback SHALL be defined — in a theme file, a component's own styles, or an inline style binding — so no element silently loses a style to an undefined token. An automated test SHALL enforce this.

#### Scenario: Typo in a token name

- **WHEN** a component references a custom property that nothing defines
- **THEN** the token test fails and names the file and property

### Requirement: PWA theme color matches the app background

The browser/PWA theme color declared in the HTML document and in the web app manifest SHALL equal the app background color, so the browser chrome and task switcher never show a color absent from the app.

#### Scenario: Installed PWA chrome

- **WHEN** the installed PWA is shown in the OS task switcher or with a colored title bar
- **THEN** the chrome color is the app background color, not a legacy brand color

## MODIFIED Requirements

### Requirement: Button styling conventions

The system SHALL provide a shared `Button` component as the standard way to render interactive action buttons (those with a text label). The component SHALL support **variants** (primary, primary-outline, secondary, danger, danger-outline, and text) and **sizes** (at minimum: small, medium, large), all driven by design tokens. Primary and danger buttons SHALL be filled (white text) with pill corners and a soft glow in their own hue. Secondary and primary-outline buttons SHALL be tonal (the control-container fill, no border); danger-outline SHALL be tonal red. Text buttons SHALL be borderless and transparent for low-emphasis actions. Every variant SHALL scale by the press-scale token while pressed. Button dimensions, padding, radius, and interaction feedback SHALL come from tokens, not per-instance literals. Full width is a layout concern handled at the call site (no `fullWidth` prop). Icon-only buttons are handled by `IconButton`; tabs and segmented switches share one global segmented-control rule.

#### Scenario: Primary button styling

- **WHEN** a primary `Button` is rendered
- **THEN** it has the primary background color, white text, pill corners, and a soft primary-tinted glow

#### Scenario: Variant and size are selectable

- **WHEN** a consumer renders `Button` with a chosen variant and size prop
- **THEN** the rendered button reflects the corresponding token-driven styling

#### Scenario: Ghost button styling

- **WHEN** a secondary (formerly ghost), primary-outline, or danger-outline `Button` is rendered
- **THEN** it is tonal: a tinted container fill, no outline border, and a label of at least 4.5:1 on the fill and on its hover fill

#### Scenario: Text button styling

- **WHEN** a `text` `Button` is rendered
- **THEN** it has a transparent background and no border (borderless, low-emphasis)

#### Scenario: Press feedback

- **WHEN** an enabled `Button` is pressed
- **THEN** it scales by the press-scale token

### Requirement: Two-tier token structure with overridable semantic layer

Design tokens SHALL be authored directly in CSS (`tokens.css`/`typography.css`) and organized in two tiers: a **primitive** tier (raw palette ramps, spacing scale, radius scale, font sizes/weights/line-heights, raw shadows — context-free values) and a **semantic** tier (e.g. `--color-surface`, `--color-on-surface`, `--color-primary`) whose values reference primitive tokens via `var()`. Application code SHALL reference semantic tokens; primitive palette colors SHALL be referenced only by semantic tokens. An alternate theme (e.g. dark mode) SHALL be expressible by overriding the semantic tier alone.

#### Scenario: Semantic token resolves through a primitive

- **WHEN** a component uses `var(--color-surface)`
- **THEN** the semantic token resolves to a value defined by a primitive palette token, not a raw literal in the component

#### Scenario: Alternate theme overrides only the semantic tier

- **WHEN** a theme is added
- **THEN** it can be expressed by reassigning semantic tokens to different primitives
- **AND** no component or palette primitive needs to change

#### Scenario: Restructuring preserves values

- **WHEN** the tokens are restructured into two tiers
- **THEN** the resolved value of each existing semantic token is unchanged from before

### Requirement: Glassmorphism utility styles

The system SHALL define one shared glass surface for map overlays — a semi-transparent brand fill with `backdrop-filter: blur()`, a hairline border, and a medium shadow — applied through a single shared class. Every control floating over the map SHALL use it, and it SHALL only be applied to map overlay components.

#### Scenario: Glass effect on map controls

- **WHEN** a map overlay component uses the glass style
- **THEN** the background is semi-transparent with a blur effect behind it, identical to every other map control

### Requirement: Shared icon-only button component

The system SHALL provide a shared `IconButton` component for inline icon-only buttons (close, back, dismiss, inline icon actions). It SHALL render a single `Icon`, expose token-driven sizing, and forward native button attributes including `disabled` and an accessible label (`aria-label`/`title`). Its corner shape SHALL be prop/token-driven (default round; a square option available). It SHALL offer a **tonal** variant on the control container, which every close and back button in sheets, dialogs, drawers, and pages SHALL use; other inline icon actions stay transparent.

#### Scenario: Icon-only button renders accessibly

- **WHEN** an `IconButton` is rendered with an icon name and an accessible label
- **THEN** it shows the icon glyph at a token-driven size, with a prop/token-driven corner shape (default round), and exposes the label to assistive tech

#### Scenario: Disabled icon-only button blocks interaction

- **WHEN** an `IconButton` is `disabled`
- **THEN** it does not emit a click

#### Scenario: Tonal navigation chrome

- **WHEN** a sheet, dialog, drawer, or page shows a close or back button
- **THEN** it is a tonal `IconButton` that darkens on hover

### Requirement: Documented exceptions to shared button components

The shared `Button` and `IconButton` components are the default for interactive controls. The system SHALL nonetheless permit the following controls to remain bespoke because they fill a **role** the shared components do not model. Each exception below is intentional and SHALL be treated as conformant; controls NOT listed here SHALL use the shared components.

- **Map overlay controls** — the speed-dial trigger and its entries (`speed-dial-trigger`, `speed-dial-item`, used by both `map-speed-dial-menu` and `map-base-map-panel`) and the compass-reset FAB (`map-action-overlay`). These are floating map overlays wearing the shared glass surface rather than the on-surface `Button`/`IconButton` palette so they stay legible over busy map tiles. They differ by role, not by accident. (The location picker's and region drawing's Cancel and Continue actions read fine as shared `Button`s, so they are **not** exempt.)
- **Persistent tour action bar** — `tour-action-bar` is a segmented pill overlay defined by its own capability spec (see `tour-action-bar`); it is not a `Button`/`IconButton` consumer.
- **Media tiles & viewer controls** — the icon controls and white-on-scrim colors in `tour-attachment-viewer` sit over arbitrary dark media and require overlay-specific contrast; the attachment thumbnail tiles (`tour-attachments-strip`) are image/PDF previews, not labelled actions. Both are media affordances, not `Button`/`IconButton` consumers.
- **Selector / toggle controls** — controls whose role is selection state rather than a discrete action MAY remain bespoke; they are not action buttons. Examples: the primary-phone star (`contact-form`, `contact-detail-view`), the add-method phone/email type selector (`contact-detail-view`), the language selector (`user-profile-sheet`), the tour completion / visibility toggles (`tour-info-sheet`), and the multi-select filter chips (`tour-form`, `tour-filters-panel`).
- **Chips & compact pills** — pill-shaped labels (`contact-chip`, the linked-tour pills and `full-row` navigation list in `linked-with-section`, the friend-partner chips in `tour-info-sheet`) are a distinct compact affordance the design system does not yet model as a base component. They are styled from the shared chip tokens in place and SHALL be extracted into a shared `Chip` component at the next demand rather than forced into `Button` (which would make them read as rectangular buttons).
- **Snackbar inline dismiss** — `error-snackbar`'s dismiss is rendered against the snackbar's own colored surface and stays bespoke.

#### Scenario: Map overlay control stays bespoke

- **WHEN** a floating map overlay control (speed dial, base-map options, compass) is rendered
- **THEN** it uses the shared glass surface and is exempt from the `Button`/`IconButton` requirement

#### Scenario: New control defaults to a shared component

- **WHEN** a new interactive control is added that is not a documented exception above
- **THEN** it uses `Button` (with a text label) or `IconButton` (icon-only)
