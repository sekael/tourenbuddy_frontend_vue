# Design

## Context

- Tokens are two-tier (`tokens.css`): palette primitives → semantic roles. Components consume semantic color roles and the spacing/radius/shadow scales directly (see `DESIGN.md`).
- Motion is not tokenized: every component hardcodes its own `transition`/`animation` (`0.15s`, `0.2s`, `0.3s`; `ease` or `cubic-bezier(0.4, 0, 0.2, 1)`).
- Shared buttons only react to `:hover` (primary/danger `scale(1.02)`, FABs `translateY(-1px)`), which touch devices lack.
- Offline toasts/chips reference tokens that were never defined (`--color-slate-800`, `--color-amber-600`, …) and offline-map sheets reference `--color-danger` (the role is `--color-error`); they render only via `var()` fallbacks and would ignore any theme.
- The language preference is persisted as `tb.locale` in `localStorage`; settings controls live in `user-profile-sheet.vue`.

## Goals / Non-Goals

**Goals:**

- Alpenglow and Classic switchable at runtime, on a real device, with zero component branching.
- Classic pixel-identical except the listed drift fixes.
- Once a winner is picked, removing the loser is deleting one CSS block plus the switcher.

**Non-Goals:**

- Retokenizing every remaining literal (glass overlay rgba, raw `font-size`s, the attachment viewer's media scrims, bottom-sheet snap transition). They are neutral in both variants.
- A generic theming framework (more than two variants, user-defined themes, server persistence).

## Decisions

### D1 — Variant = attribute-scoped token override block

`<html data-design="classic|alpenglow">`. Classic values stay in `:root`; Alpenglow is one `:root[data-design='alpenglow'] { … }` block in `tokens.css` that reassigns semantic roles and retunes the radius/shadow scales.

- *Why:* the semantic tier was built for exactly this; one attribute flip restyles the whole app with no re-render logic, and "promote the winner" is a mechanical edit.
- *Alternatives:* a second stylesheet loaded on demand (FOUC, two sources to keep in sync); `prefers-color-scheme`-style media switch (not user-selectable); per-component `[data-design]` selectors (rejected by spec — branching spreads the variant into every file).
- *Radius/shadow scales:* overridden directly rather than via new semantic aliases — components already consume the scales directly, and aliasing ~80 files for a short-lived comparison is churn. The spec's two-tier requirement is relaxed accordingly (palette, spacing and type stay fixed).

### D2 — Motion and interaction tokens with Classic = today's literals

Semantic tokens: `--motion-duration-{short,medium,long}` (150/200/300 ms), `--motion-ease-standard` (`ease`), `--motion-ease-emphasized` (`cubic-bezier(0.4, 0, 0.2, 1)`), `--motion-ease-spring` (`ease`), `--hover-scale` (1.02), `--press-scale` (1). Each migrated transition maps to the token whose Classic value equals its literal, so Classic is unchanged.

| Usage | Duration | Easing |
|---|---|---|
| color/opacity state changes | short/medium | standard |
| sheet slide (`map-page`), drawer slide, dialog enter, banners | long/medium | emphasized / standard |
| press/hover transform, snackbar, sync toast, action pill | short/medium | spring |

Alpenglow: 160/240/420 ms; standard `cubic-bezier(0.2, 0, 0, 1)`, emphasized `cubic-bezier(0.32, 0.72, 0, 1)` (iOS sheet curve — decelerates hard, no overshoot, so a sliding sheet never lifts off the bottom edge), spring `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot, only for small elements where a few px of overshoot reads as "pop").

- *Press on primary/danger:* `:active` uses `scale(calc(var(--hover-scale) * var(--press-scale)))` so Classic keeps its 1.02 while pressed and Alpenglow gets 0.96. Other variants use `scale(var(--press-scale))`. FABs keep their hover lift: `translateY(-1px) scale(var(--press-scale))`.
- *Reduced motion:* a `@media (prefers-reduced-motion: reduce)` block on `:root[data-design]` (specificity ties the Alpenglow block and wins by order) sets spring → standard and both scales → 1.

### D3 — Persistence and boot

`src/core/theme/design-variant.ts`: a module-level `designVariant` ref (core signal, like `isOnline`), `readDesignVariant()` (whitelist-validated `localStorage` read, `try/catch` → `'classic'`), `setDesignVariant(v)` (sets ref + `documentElement.dataset.design`, best-effort persist). `main.ts` calls `setDesignVariant(readDesignVariant())` synchronously at module top — before `bootstrap()` awaits auth — so the first paint already has the attribute.

- *Why not Pinia:* the value is needed before Pinia exists and in `core/`, which must not depend on feature stores. *Why not an inline `<script>` in `index.html`:* `#app` is empty until mount, so applying in `main.ts` cannot flash; an inline script would duplicate the whitelist.
- *Key:* `tb.design`, mirroring `tb.locale`.

### D4 — Switcher inline in the profile sheet

A second section under the language selector, styled by extending the language-option selectors (`.language-option, .design-option`). Not a new component: DESIGN.md says extract segmented controls at second usage, but this switcher is scaffolding that is deleted when the comparison ends.

### D5 — Theme color = background (`#ffffff`)

Static in `index.html` and the manifest. Both variants share a white background, so no runtime `<meta>` update is needed. A brand-colored bar was rejected: the map page is full-bleed and a white chrome blends in on every route.

### D6 — Alpenglow palette

New primitives: blue `50/600/950`; plus `slate-800`, `amber-600`, `amber-700` for the drift fixes. Alpenglow reassigns `primary*` → blue 600/500/700 (white on blue-600 = 5.17:1), `accent` → blue-500, `surface-variant` → blue-50 (tinted hover/selected), `fab-surface` → blue-950 (deep navy), `fab-surface-strong` → blue-700, `inverse-surface` → blue-950. *Iteration 3:* the first cut used indigo; the owner preferred blue tones, so indigo was swapped out (no indigo primitives remain). Error/success/warning/friend/route colors stay — they carry meaning on the map. Outlines stay (input-border contrast).

### D7 — Component tokens defined only by the variant (iteration 2)

Element styling (button fills, overlay chrome, headings, inputs, chips, tabs, dividers) is hardcoded per component and has drifted (audit: 6 section-heading variants, 4 selected-chip treatments, 8 input variants). Classic must stay unchanged, Alpenglow must be consistent — so the two cannot share one set of values.

Each consumer reads a **component token with its own current value as the fallback**: `border-radius: var(--chip-radius, var(--radius-sm))`. Component tokens are **not defined in `:root`**; only the Alpenglow block defines them. Classic therefore renders every component exactly as before (fallback), and Alpenglow renders every instance of an element from one value.

Token families (all `--<element>-<property>`): `--button-*`, `--overlay-*`, `--heading-section-*`, `--field-label-color`, `--input-*`, `--chip-*`, `--tabs-*`/`--tab-*`, `--divider-color`.

- *Alternatives:* (a) give Classic explicit values — impossible without unifying Classic, since its current values differ per component; (b) a global stylesheet of `[data-design='alpenglow'] .chip {…}` overrides — branches on the variant and fights scoped-style specificity; (c) shared `Chip`/`Input`/`Tabs` components — the right end state, but a template migration across ~15 large files that is wasted if Classic wins. Tokens first; extract components once the winner is chosen (DESIGN.md's "extract at second usage" rule is now clearly met for chips, inputs, and tabs).
- *Promotion:* if Alpenglow wins, move its component tokens into `:root` (fallbacks become dead and can be stripped in the same follow-up). If Classic wins, delete the block; fallbacks remain as plain values.

### D8 — Motion for tabs, sheet swaps, and in-sheet views (iteration 3)

- **Tab indicator:** one opt-in utility in `global.css` — `[data-tab-indicator]::before`, positioned from inline `--tab-index`/`--tab-count`, painted from `--tab-active-bg`, sliding on `--motion-ease-spring`. Used by the four underline-tab rows (tour list, friend requests, both help sheets). Undefined `--tab-active-bg` keeps it invisible in Classic. *Alternatives:* View Transitions API (snapshots the whole page incl. the WebGL map — freezes it mid-animation); a shared `Tabs` component (right end state, but four templates + their tests for a comparison-period change).
- **Sheet → sheet:** `map-page` switches its `<Transition>` name to `sheet-swap` when `activeOverlay` goes from one overlay to another (sync watcher, so the name is set before the leave starts). Classic fallbacks reproduce `sheet` exactly; Alpenglow lifts 32 px + fades (leave 160 ms, enter 240 ms) instead of 2 × 420 ms full slides.
- **In-sheet swaps:** `<Transition mode="out-in">` with direction-specific names (`view-push`/`view-pop`, chosen from the *new* state so the leaving view gets the right direction) in the contacts sheet, and a `tab-swap` keyed on the active tab in the tour list (direction via `--swap-dir` on the stable scroller). Classic fallbacks are `0s`, no offset, opaque — Vue completes a zero-duration transition within two frames, with the old content visible until the swap.
- **Snap:** bottom-sheet height transition on `--sheet-snap-*` (Classic: 200 ms ease-out).

### D9 — Declutter: tokens where it is styling, small structural fixes where it is not (iteration 3)

Styling-level clutter is removed in Alpenglow only, through new component tokens: `--section-divider-color`/`-display` (section breaks from spacing + headings), `--tonal-tint` and `--toggle-*` (tonal state pills; the two tour-sheet toggles in a wrapping row — the wrapper is `display: contents` in Classic so their layout is untouched), `--card-*` (fill-only cards).

Four problems are structural and cannot be scoped to a variant without branching templates, so they are fixed for **all** variants (Classic changes here, deliberately): the contact detail's second header row (moved into the overlay header via a `headerless` prop + `header-actions`), the missing planned date in tour rows, the oversized tour-edit Save, and `DialogWindow` lacking `header-actions`.

### D10 — Map controls, contrast, and calm motion (iteration 4)

- **Map controls** keep using the `--color-fab-*` roles; Alpenglow sets the surface to blue-700 (hover/selected blue-800) with the :root white glyphs. Measured: white on blue-700 at the 85% glass mix is 4.92:1 over white map, 5.93:1 over grey terrain; blue-950 (first cut) read as too dark, white glass (second cut) as too bright and lost separation. Dot/badge become white (orange would be 2.4:1 on blue-700). Persistent offline/sync chips join via `--map-chip-*`; transient toasts stay inverse slate. The light "Cancel" pills in location picking / region drawing stay light — they are the secondary next to a primary blue Confirm.
- **Contrast fixes** are roles, not one-offs: `--color-success-text` (green-800 — green-600 is 3.3:1), `--color-warning-text`, `--color-on-surface-variant` for hints; text on Alpenglow tints uses the `-dark` shade (`--tint-text-*`, `--button-*-outline-color`). The guided-tour "finish" button is a ghost in the banner's on-color, with a selector that out-specifies `BaseButton`'s variant rules (stylesheet order let iteration 2's tonal fill slip under its white label).
- **Motion** retuned in tokens only (Classic untouched): 200/320/480 ms, `cubic-bezier(0.22, 0.7, 0.3, 1)` emphasized, spring overshoot ~3%, swap offsets halved, press 0.97.

### D11 — Stable dialogs and anchored base-map options (iteration 4)

- `DialogWindow` gains `stableSize` (fixed `min(40rem, 90dvh)`, content scrolls; collapsed state still clamps), passed through `AdaptiveOverlay`; opted into by contacts, friend requests, and profile — the overlays whose content switches views/tabs. Confirm-style dialogs keep fitting their content.
- Base-map options: a pre-flush watcher measures the "Change base map" item when `view` goes `menu → base-map`; the panel is pinned there (`position: fixed`), unfolds downward from its top-right, and the menu fades instead of the `panel` collapse. The anchor is kept while the panel leaves; direct opens (no menu) and the landscape arc layout fall back to the in-flow position. The guided tour's base-map step goes through the same `menu → base-map` path.

## Risks / Trade-offs

- [Alpenglow untested on every screen] → the switch is reversible in one tap; components that still carry literals (glass overlays, media viewer) are neutral and fit both variants.
- [Classic not perfectly identical] → only the drift fixes change pixels: dead-letter empty-state text `slate-500 → slate-600` and item background `slate-100 → slate-200` (no matching tokens existed), and the offline-download warning text `amber-500 → amber-700` (it used `--color-warning`, 2.15:1 on white; its own fallback showed amber-700 was intended).
- [Reduced-motion users lose Classic's 1.02 hover scale] → intended; spec requires it.
- [Classic changes beyond drift fixes (iteration 3)] → limited to the four structural fixes in D9, each a usability fix independent of visual style; prod remains the reference for "before" via the PR preview.
- [Stable dialogs show empty space for short content] → chosen deliberately: the owner prefers a constant frame over a resizing one.
- [Accessibility fixes change Classic] → text-contrast, labeling, and attribution fixes apply to every variant (they are defects, not style).
- [Out-in swaps delay the new content by the leave duration] → leave halves are short (160 ms) in Alpenglow and zero in Classic.
- [Overriding radius/shadow scales is less pure than semantic aliases] → bounded to the comparison period; the promote-the-winner follow-up removes the override block.

## Migration Plan

Ship with Classic as default — no user sees a change unless they opt in. Owner compares via the profile switcher (locally or on the PR preview). Follow-up change: move the winner's values into `:root`, delete the other block, the switcher, `design-variant.ts`, and the i18n keys. Rollback: revert the PR; a stale `tb.design` key is ignored by the whitelist.
