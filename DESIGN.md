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
- Desktop dialogs whose content switches views/tabs pass `stable-size` so they don't
  resize; options opened from a menu item appear at that item.

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
opened: items rise from the trigger one after another, nearest first (40ms apart);
base-map options opened from "Change base map" drop from that item, top first,
while the menu fades in place. Closing is one quiet fade. Items animate on mount
via keyframes (`map-action-overlay.vue`) — not under a `*-enter-active` class,
which Vue drops after one frame when the Transition root has no transition of its
own.

**No needless motion.** Only what the user acted on moves; dialogs don't resize
between views; nothing bounces.

### Component tokens

Recurring elements share component tokens in `tokens.css` so each element family
has exactly one treatment: `--button-*`, `--overlay-*` (sheet/dialog/drawer/page
chrome), `--heading-section-*`, `--field-label-color`, `--input-*`, `--chip-*`,
`--divider-color`, `--card-radius`. New instances of these elements must use them.
`test/app/theme/component-tokens.test.ts` fails on any `var(--x)` that nothing
defines (an undefined token silently resolves to `transparent`/`0`/`none`).

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
and the `selected` class). In landscape the pills become 48px circles on a
quarter-circle arc around the trigger.

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
  language selector, the tour completion/visibility toggles (`tour-info-sheet`:
  tonal at rest, tinted only in their non-default state), multi-select filter
  chips (`tour-form`, `tour-filters-panel`).
- **Chips & compact pills** (`contact-chip`, `linked-with-section`, friend
  partner chips) — pill affordance with no base component yet; styled from the
  `--chip-*` tokens in place.
- **`error-snackbar` dismiss** — sits on the snackbar's own colored surface.

Anything not on this list uses the shared components.
