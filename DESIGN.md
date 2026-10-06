# TourenBuddy — Design Language

Single source of truth for the app's visual language: the structure, rules, and
rationale behind the theme. It is the starting point for design sessions
(human or generative, e.g. Stitch).

> **Exact values live in code, not here.** `src/app/theme/tokens.css` and
> `typography.css` are canonical for every hex, size, and scale step. This
> document describes _how the system is organized and used_ and points at those
> files rather than copying values that would then drift.

> **Screenshots:** none are stored in this repo. Any design work based on this
> document MUST be supplemented with up-to-date screenshots of the running app
> captured **at the time of use** — the UI evolves and stale images mislead.

---

## Token architecture — two tiers

Tokens are authored directly in CSS (no build pipeline) in two tiers:

1. **Primitive tier** — raw, context-free values: palette ramps
   (`--slate-*`, `--blue-*`, `--red-*`, `--green-*`), the spacing scale, radius
   scale, raw shadows, and the type scale. These carry no meaning beyond "a
   value on a scale".
2. **Semantic tier** — contextual aliases that reference primitives via `var()`
   (e.g. `--color-primary: var(--blue-600)`, `--color-surface`,
   `--color-on-surface`). **Application and component code references the
   semantic tier only**; primitives are referenced solely by semantic tokens.

**Why two tiers:** a future theme (e.g. dark mode) becomes a remap of the
semantic tier onto different primitives — no primitive or component change
required. Dark mode itself is deferred; the structure is ready for it.

**Not tokens:** runtime CSS functions such as `env(safe-area-inset-*)` are _not_
design tokens (they resolve per-device at paint time). They live in
`src/app/theme/safe-area.css`, never in `tokens.css`.

### Scales (see `tokens.css` / `typography.css` for exact values)

- **Spacing** — 4-point scale, `--spacing-xxs` … `--spacing-3xl`.
- **Radius** — `--radius-sm` / `--radius-md` / `--radius-lg` (10/20/28px), plus
  `--radius-pill`. Action buttons use `--button-radius` (pill).
- **Shadows** — three elevations `--shadow-sm/md/lg`: soft, diffuse, blue-950-tinted.
- **Type** — Inter; sizes `--font-size-xs` … `--font-size-3xl`; weights
  regular/medium/semibold/bold; line-heights tight/normal/relaxed. Numbers that
  must align (coordinates) use `font-variant-numeric: tabular-nums`, never a
  monospace font.

### Color roles

Blue is the brand (`--color-primary` blue-600, `--color-primary-dark` blue-700);
slate carries text and outlines. Surface / on-surface, background / on-background,
outline, error, warning, and success roles are all semantic tokens in `tokens.css`.

- **Containers.** `--color-surface-variant` (blue-50) is the quiet tint for cards,
  hovered rows and info boxes. `--color-secondary-container` (blue-100, hover
  blue-200, label `--color-on-secondary-container` blue-900) is one step stronger
  and is reserved for **controls**: tonal buttons, close/back circles, tab tracks,
  nav indicators — strong enough to stand off a white sheet and off a
  surface-variant card.
- **Map controls** have their own `--color-fab-*` roles: blue-700 glass
  (`--color-fab-glass`, hover/selected `--color-fab-glass-strong`) with white
  glyphs — ≥ 4.9:1 even at 85% over a white map.
- **Inverse.** Dark floating toasts use `--color-inverse-surface` /
  `--color-on-inverse-surface`.
- **Status text.** `--color-error-text`, `--color-success-text`,
  `--color-warning-text` are the text/icon shades of their hues (the plain
  `--color-error` / `--color-success` / `--color-warning` fills are too light for
  text on tints).

### Accessibility rules

- All text ≥ 4.5:1 (WCAG 2.2 AA) — verify new colors before use, including on the
  hover fill.
- Success/warning/error as text use their `-text` roles, never the plain fills.
  Hints use `--color-on-surface-variant`, not `--color-outline`.
- Text on a tinted fill uses the darker shade of its hue (`--color-primary-dark`,
  `--color-on-secondary-container`, `--color-error-text`).
- A control that sits on a fixed surface (e.g. the guided-tour banner) styles its label
  against that surface explicitly — never inherit a button fill under it.
- Every form control has an accessible name (a visible `<label>` or `aria-label`
  — toggle switches included).
- Options opened from a menu item appear at that item.

### Motion & interaction

Calm and unhurried. Never hardcode a duration or easing — pick by role:

- `--motion-ease-standard` — color/opacity state changes.
- `--motion-ease-emphasized` — things sliding, growing or gliding into view
  (sheets, drawers, dialogs, banners, swaps, the tab pill). No overshoot.
- `--motion-ease-spring` — press transforms and small toggles (switch thumb).
  ~3% overshoot, so never for anything anchored to an edge.
- `--motion-duration-short/medium/long` (200/320/480ms) — roughly state change /
  glide / sheet.
- `--motion-offset` (12px) — the travel of anything gliding in.
- `--press-scale` — `:active` on every shared button, FAB and map control. No hover
  lifts or hover scaling: touch screens never see them.

`prefers-reduced-motion: reduce` turns spring into standard, press into `1` and the
offset into `0` (bottom of `tokens.css`) — motion becomes plain fades.

**Navigation motion.** Content swaps use `<Transition mode="out-in">`: the old view
fades out (short), the new one eases in from `--motion-offset` (medium). Pick the
transition _name_ from the new state when direction matters — the leaving element
keeps its old bindings. Sheet → sheet uses `sheet-swap`.

**Expanding menus** (speed dial, base-map options) unfold from where they were
opened: items rise from the trigger one after another, nearest first (40ms apart).
"Change base map" keeps the menu open — the item darkens, the rest dims and goes
`inert` — and its options slide out beside it (left of it; upward on the landscape
arc). A tap outside the options, on a dimmed item included, or a choice closes the
whole menu in one quiet fade. Items animate on mount via keyframes
(`map-action-overlay.vue`) — not under a `*-enter-active` class, which Vue drops
after one frame when the Transition root has no transition of its own. The overlay
box itself is `pointer-events: none` (only its buttons and the backdrop take taps),
and the unfolded slot overrides driver.js's `overflow: hidden` on a spotlit
element's parent so the guided tour can show the options.

**Views inside one overlay** push and pop (`view-push` / `view-pop` in
`global.css`): forward slides in from the right, back from the left.

**Dialogs fit their content.** A desktop dialog (`dialog-window.vue`) is always as
tall as what it currently shows — no fixed frames, no empty bands. It hangs from a
fixed top line (`--dialog-inset`, `clamp(24px, 12dvh, 7rem)`), so when a view, tab
or loaded data changes its height only the bottom edge glides (emphasized, medium)
and the header never moves; the same inset is kept below, so at full height it
sits balanced and the content scrolls. The slot sits in a
`.dialog-body` that keeps its natural height (never stretched); a ResizeObserver
on it drives the scroll box's height. Content inside a dialog must not rely on
filling a fixed height.

**Mobile sheets fit their content too.** A fit-content bottom sheet
(`bottom-sheet.vue`) follows its content both ways, like a desktop dialog: the slot
sits in a natural-height `.content-body`, a ResizeObserver refits, and the height
glides. It opens at the content height (capped at 70% of the visible viewport).
Only when the content needs more than that does it show a drag handle — expand to
the full content (capped at 90%) or drop to peek; a flick moves one snap. Content
that fits gets no handle: there is nothing to reveal. Browse sheets the user
sizes against the map (tour list, tour detail) pass `resizable`: always a handle,
snapping to peek, the opening height (content, ≤ 40%) and full content (≤ 70%).
Any draggable sheet drags from its header too (not its buttons), and past the top
snap it rubber-bands instead of stopping dead, so a short sheet still answers the finger.
The tour detail wears its activity colour (`TOUR_TYPE_COLORS`, as on the map
marker and list avatar) via one `--type-tint`; completed / private stamp the badge
(success ring / dashed edge on the header card).
Tabs inside a mobile sheet keep one height: stack the panels in one grid cell
(inactive one `visibility: hidden` + `inert`) so switching never resizes the sheet
(friend requests). Sheets live in a `.sheet-host` (over the page, wrap
in `<Transition name="sheet">`) or a `.sheet-host--modal` (scrim; rises on mount)
from `global.css`.

**Sheet ⇄ page fades through.** Swapping a sheet for its full-screen page (and
back), or closing from a page, never hard-cuts: the outgoing surface fades out via
`useExitAnimation` while the incoming one fades/rises in. Use that composable for
any surface its owner removes with `v-if` — a `<Transition>` only plays a leave while
it stays mounted itself.

**Touch.** Hover fills go inside `@media (hover: hover)` with an identical
`:active` rule, so taps get feedback and nothing stays tinted after a tap on iOS.
Bottom-anchored toasts and chips use `--float-bottom` / `--float-corner-bottom`,
which lift them above any open sheet.

**No needless motion.** Only what the user acted on moves; nothing bounces.

### Component tokens

Recurring elements share component tokens in `tokens.css` so each element family
has exactly one treatment: `--button-*`, `--overlay-*` (sheet/dialog/drawer/page
chrome), `--heading-section-*`, `--field-label-color`, `--input-*`, `--chip-*`,
`--divider-color`, `--card-radius`. New instances of these elements must use them.
`test/app/theme/component-tokens.test.ts` fails on any `var(--x)` that nothing
defines (an undefined token silently resolves to `transparent`/`0`/`none`).

### Settings at a glance (profile)

A settings screen opens on an **overview** that fits without scrolling: an identity
card (tap → edit), one card of setting rows — an inline control where the choice is
tiny (language), otherwise label over its current value ("Email only", "Sync
problem" in error text) with a chevron to the section — and one secondary action
(Sign out). Rows share one fixed height so summaries loading in never shift the
sheet. Each section opens as its own view: a full-screen page on mobile, the same
dialog with a back button on desktop (it glides to each section's height). Only primary and secondary
buttons appear on these screens — no text buttons.

### Shared surfaces (`global.css`)

- **`.fab-glass`** — the one surface for everything floating over the map (speed
  dial and items, compass, tour pill, base-map options, status chips). A control
  adds only its shape and its hover/selected fill.
- **Segmented tabs** — a row with `data-tab-indicator` plus inline
  `--tab-index`/`--tab-count` gets the tonal track, equal-width buttons and a white
  pill that glides under the selected one (`aria-selected` for tabs, `aria-pressed`
  for filter switches). Used by the tours, friend-request, filter and help tabs; no
  scoped tab CSS.

---

## Components

Icons and buttons are consumed through shared components in
`src/core/components/`, never re-styled per file.

### Icon — `base-icon.vue`

Wraps a Material Symbols glyph. Props: `name` (ligature), `size`
(`sm`/`md`/`lg`/`xl`, **optional** — when omitted the glyph inherits the global
20px default or a consumer's own `font-size`, so context-sized icons like small
badges migrate faithfully), optional `weight`. Always decorative
(`aria-hidden`); the accessible name belongs on the surrounding control.

### IconButton — `base-icon-button.vue`

Inline icon-only button (close, back, dismiss, inline actions). Props: `name`,
`label` (→ `aria-label` + `title`), `size` (`sm`/`md`/`lg`), `shape`
(`round` default, `square`), `tone` (`danger` tints on hover), `variant`
(`standard` transparent, `tonal` on the secondary container). **Navigation chrome
— close and back in every sheet, dialog, drawer and page — is `tonal`**; other
header actions stay `standard`.

### Button — `base-button.vue`

Action button with a text label, pill-shaped. Props: `variant` and `size`
(`sm`/`md`/`lg`, 36/48/56px min-height):

- `primary` / `danger` — filled with a soft glow in their own hue; the one decisive
  action of a view.
- `secondary` / `primary-outline` — **tonal**: secondary container fill
  (blue-900 / blue-700 label). Every other action.
- `danger-outline` — tonal red (error container, `--color-error-text` label).
- `text` — transparent, primary-colored; low emphasis ("Don't show again").

Every variant scales by `--press-scale` while pressed. Over the map, a tonal
button adds `--shadow-md` to lift off bright terrain. Native attrs fall through to
the root `<button>`.

**Full width is a layout concern, not a prop.** `BaseButton` is intrinsic-width;
make it full-width at the call site (a flex/grid parent that stretches it, or a
`:deep(.base-button) { width: 100% }` rule in the consumer's scoped styles).

### ExtendedFab — `extended-fab.vue`

A primary action floating over a page (calendar "Edit availability"): the primary
button's fill and glow at 52px.

### SpeedDialItem — `features/map/…/speed-dial-item.vue`

One glass pill per map-menu action: label, then icon, the icon centred on the
trigger's axis so the menu reads as one column. The speed-dial menu and the
base-map options both use it (choices pass `role="menuitemradio"`, `aria-checked`
and the `selected` class). The menu takes an `expanded` item id and renders its
default slot (the base-map options) inside that item's slot. In landscape the
menu's own pills become 48px circles on a quarter-circle arc around the trigger;
unfolded options keep their labels.

### Usage rules

- Action with a label → `Button`. Icon-only action → `IconButton`. A glyph →
  `Icon`. Never hand-roll a styled `<button>` or a raw
  `material-symbols-outlined` span in feature code.
- No hardcoded hex / `font-size` / `border-radius` / duration literals where a
  token exists — reference `var(--*)`.

### Documented exceptions

Some controls stay bespoke by **role**, not oversight. These are exempt from the
`Button`/`IconButton` rule (see `design-system` spec for the canonical list):

- **Map overlays** — speed-dial trigger and `SpeedDialItem` (menu + base-map
  options), the compass FAB (`map-action-overlay`). They wear `.fab-glass`, not the
  on-surface button palette.
- **`tour-action-bar`** — segmented pill overlay with its own spec (`.fab-glass`).
- **Media tiles & viewer** (`tour-attachment-viewer`, `tour-attachments-strip`)
  — white-on-scrim controls over dark media and image/PDF preview tiles; media
  affordances, not action buttons.
- **Selector/toggle controls** — state selectors, not action buttons: primary
  star (`contact-form`, `contact-detail-view`), add-method type selector and
  segmented language selector, the tour completion/visibility toggles (`tour-info-sheet`:
  tonal at rest, tinted only in their non-default state), multi-select filter
  chips (`tour-form`, `tour-filters-panel`).
- **Chips & compact pills** (`contact-chip`, `linked-with-section`, friend
  partner chips) — pill affordance with no base component yet; styled from the
  `--chip-*` tokens in place.
- **Settings rows** (`profile-overview`) — identity card and setting rows are
  full-width navigation list items (label over value, chevron), not actions.
- **`error-snackbar` dismiss** — sits on the snackbar's own colored surface.

Anything not on this list uses the shared components.
