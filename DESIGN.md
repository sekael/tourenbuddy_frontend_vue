# TourenBuddy — Design Language

Single source of truth for the app's visual language: the structure, rules, and
rationale behind the theme. It is the starting point for design sessions
(human or generative, e.g. Stitch).

> **Exact values live in code, not here.** `src/app/theme/tokens.css` and
> `typography.css` are canonical for every hex, size, and scale step. This
> document describes *how the system is organized and used* and points at those
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
   (e.g. `--color-primary: var(--slate-600)`, `--color-surface`,
   `--color-on-surface`). **Application and component code references the
   semantic tier only**; primitives are referenced solely by semantic tokens.

**Why two tiers:** a future theme (e.g. dark mode) becomes a remap of the
semantic tier onto different primitives — no primitive or component change
required. Dark mode itself is deferred; the structure is ready for it.

**Not tokens:** runtime CSS functions such as `env(safe-area-inset-*)` are *not*
design tokens (they resolve per-device at paint time). They live in
`src/app/theme/safe-area.css`, never in `tokens.css`.

### Scales (see `tokens.css` / `typography.css` for exact values)

- **Spacing** — 4-point scale, `--spacing-xxs` … `--spacing-3xl`.
- **Radius** — `--radius-sm` / `--radius-md` / `--radius-lg`. Action buttons use
  their own `--button-radius` (off-scale).
- **Shadows** — three elevations `--shadow-sm/md/lg` (layered, slate-tinted).
- **Type** — Inter; sizes `--font-size-xs` … `--font-size-3xl`; weights
  regular/medium/semibold/bold; line-heights tight/normal/relaxed.

### Color roles

Slate is the primary family; blue is the accent. Surface / on-surface,
background / on-background, outline, error, and success roles are all semantic
tokens in `tokens.css`. The floating map FAB has its own dark-azure `--color-fab-*`
roles so it stays distinct from Swisstopo terrain.

---

## Components

Icons and buttons are consumed through shared components in
`src/core/components/`, never re-styled per file.

### Icon — `base-icon.vue`
Wraps a Material Symbols glyph. Props: `name` (ligature), `size`
(`sm`/`md`/`lg`, default `md` = 20px, the global default), optional `weight`.
Always decorative (`aria-hidden`); the accessible name belongs on the
surrounding control.

### IconButton — `base-icon-button.vue`
Inline icon-only button (close, back, dismiss, inline actions). Props: `name`,
`label` (→ `aria-label` + `title`), `size` (`sm`/`md`/`lg`), `shape`
(`round` default, `square`). Token-sized touch target; native attrs
(`disabled`, click) fall through to the root `<button>`.

> **Distinct from the FAB.** `round-action-button.vue` is a fixed 52px floating
> control; `IconButton` is inline and token-sized. They differ by *role*, not by
> corner shape (most inline icon buttons are round too).

### Button — `base-button.vue`
Action button with a text label. Props: `variant`
(`primary` / `secondary` / `danger` / `text`) and `size` (`sm`/`md`/`lg`), all
token-driven. Primary/danger are filled and lift slightly on hover; `secondary`
is a ghost (transparent + outline); `text` is borderless (transparent, no
border) for low-emphasis actions like "Dismiss". Native attrs fall through to
the root `<button>`.

**Full width is a layout concern, not a prop.** `BaseButton` is intrinsic-width;
make it full-width at the call site (a flex/grid parent that stretches it, or a
`:deep(.base-button) { width: 100% }` rule in the consumer's scoped styles).

### Usage rules
- Action with a label → `Button`. Icon-only action → `IconButton`. A glyph →
  `Icon`. Never hand-roll a styled `<button>` or a raw
  `material-symbols-outlined` span in feature code.
- No hardcoded hex / `font-size` / `border-radius` literals where a token
  exists — reference `var(--*)`.

### Not componentized yet — tabs & segmented toggles
Tabs (`friend-requests-sheet`) and segmented toggles each have a **single**
consumer today, so they are styled from tokens **in place** rather than
extracted (YAGNI). **Extract a shared `Tabs` / `SegmentedControl` component at
the second usage** — at that point they should follow the same token-driven
conventions as `Button`.
