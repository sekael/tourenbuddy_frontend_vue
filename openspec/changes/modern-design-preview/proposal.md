# Proposal

## Why

The app works, but it reads as utilitarian: a grey (slate) primary on grey surfaces, hairline borders everywhere, and motion that is either absent or a uniform `ease`. On mobile — where most users are — buttons give no tactile feedback at all (the only interaction effect is a `:hover` scale, which touch screens don't have, and which sticks after a tap on iOS). The June change `standardize-app-theme` built the two-tier token system precisely so a visual redesign could be "a semantic remap" and explicitly deferred that redesign; this is that change. Because a redesign is a taste call, the owner must be able to compare it against today's look on a real device before committing to it.

## What Changes

- Add an opt-in **"Alpenglow" design variant**, expressed purely as token overrides under `:root[data-design='alpenglow']`:
  - vivid blue brand primary with brand-tinted surface variants (outlines unchanged — they also draw input borders, whose contrast is already low),
  - larger corner radii and pill-shaped action buttons,
  - softer, more diffuse, brand-tinted shadows,
  - a deep navy map-FAB surface and inverse surface (toasts/chips),
  - springy "pop" easing for small overlays (dialogs, snackbars, pills, chips), an iOS-style curve for sheet slide-in, and slightly longer durations,
  - press-down feedback (`:active` scale) on shared buttons and FABs instead of hover scale.
- Keep the current look as the **"Classic"** variant (`:root` defaults) and the **default**. Every new token has a Classic value equal to today's literal, so Classic is visually unchanged (except the drift fixes below).
- Add a **design switcher** in the profile sheet (Classic / Alpenglow — preview). The choice is persisted per device in `localStorage` and applied to `<html data-design>` before mount, so there is no flash of the other design.
- Introduce **motion tokens** (`--motion-duration-*`, `--motion-ease-*`) and **interaction tokens** (`--press-scale`, `--hover-scale`), consumed by the shared button/FAB/overlay components and the main enter/leave transitions. `prefers-reduced-motion: reduce` disables overshoot and press scaling for both variants.
- Fix theme **drift** that would otherwise ignore any variant: offline toasts/chips reference non-existent tokens (`--color-slate-800`, `--color-amber-600`, …) and offline-map sheets reference a non-existent `--color-danger`; five dialogs hardcode the backdrop color. These move onto semantic tokens (new: `--color-inverse-surface`, `--color-on-inverse-surface`, `--color-warning-strong`, `--color-warning-text`).
- Fix the stale **PWA theme color**: `index.html` `theme-color` and the manifest `theme_color` are still `#e65100`, the orange from before the April refresh. Both become the app background (`#ffffff`), which both variants share.
- **Iteration 2 — consistent UI elements (owner feedback: "colors changed, but the general design still looks the same").** A palette remap cannot reach element styling that is hardcoded per component, and an audit shows that styling has drifted: section headings come in 6 variants across 12 rules, selectable chips have 4 different "selected" treatments, and inputs 8 one-off variants. Alpenglow therefore also restyles the recurring UI elements, each converging on **one** treatment:
  - **Buttons:** tonal (tinted fill, no outline) secondary/outline variants, a soft brand glow under primary, comfortable minimum heights, primary-colored text buttons.
  - **Overlays (sheets, dialogs, drawers, full-screen pages):** borderless cards and headers, larger tight-tracked titles, a tonal circular close button, a stronger backdrop blur.
  - **Section headings:** one sentence-case style instead of six uppercase micro-label variants; **field labels** in on-surface.
  - **Inputs:** softly filled, rounder, with a brand focus ring.
  - **Selectable chips/options:** pill-shaped with a single tinted selected state.
  - **Tabs:** pill segmented control instead of underline tabs.
  - **Dividers:** lighter.
  These are **component tokens** defined only by the Alpenglow block; each consumer's `var()` fallback is its current value, so Classic stays unchanged.

- **Iteration 3 — blue, smooth, uncluttered (owner feedback: "blue tones instead of purple; nothing cluttered; smooth transitions, e.g. switching own/friend tours; no dead space").**
  - **Blue** brand palette instead of indigo.
  - **Motion:** a sliding pill indicator for tab rows with the panel sliding toward the chosen tab; sheet→sheet navigation as a quick lift-and-fade instead of a full slide-down + slide-up (~840 ms → ~400 ms); push/pop slides inside the contacts sheet; sheet snapping on the motion curves. All are component tokens — instant (unchanged) in Classic.
  - **Declutter (Alpenglow):** no section divider lines (spacing + headings separate sections), tonal pill toggles side by side in the tour sheet, pill season tags, fill-only cards in the tour form and friend lists.
  - **Structural fixes (all variants):** the contact detail view had a second header row under the sheet header — title, back, and Edit now live in the overlay header; tour list rows show the planned date (the most-scanned fact, previously absent); the tour-edit Save button matches every other Save (`sm`); `DialogWindow` gains the `header-actions` slot that sheets and drawers already have.

- **Iteration 4 — legible map controls, calm motion, accessibility, no needless motion (owner feedback: map buttons too dark → then too bright; "Tour beenden" hardly legible; animations hurried; dialogs resize; base-map options appear from a collapsed menu; keep the guided tour current).**
  - **Map controls** (speed dial, labels, compass, action bar, base-map options, persistent offline/sync chips, guided-tour banner): brand blue-700 glass with white glyphs — lighter than the old navy, white text ≥ 4.9:1 even at 85% over a white map; notification dot/badge turn white so they stay visible on blue.
  - **Calmer motion:** 200/320/480 ms, a gentle ease-out instead of the front-loaded iOS curve, ~3% spring overshoot instead of ~10%, half the travel on swaps, subtler press scale.
  - **Accessibility:** an axe-core WCAG 2.2 A/AA audit of every main screen in both variants, fixed to zero violations — text on tinted fills uses the darker shade, new `--color-success-text` role, low-contrast hint/warning text, an unlabeled GPX input, color-only map attribution links, and the guided-tour "finish" button (a tonal fill under its white label — introduced in iteration 2).
  - **No needless motion:** base-map options unfold from the "Change base map" item that opened them (the menu fades in place instead of collapsing first); desktop dialogs that switch views/tabs (contacts, friend requests, profile) keep one height.
  - **Guided tour** walked end-to-end (all 9 steps, German) after the changes; targets and copy unchanged and still accurate.

- **Iteration 5 — Alpenglow becomes the only design; consistency sweep (owner: "I like the new design … only keep Alpenglow; buttons modern but with enough contrast to separate them from pages and objects; expanding action buttons consistent; transitions smooth, calm and beautiful").**
  - **One design:** Alpenglow's values move into `:root`; the variant block, `design-variant.ts`, its boot call, the profile-sheet switcher and its i18n keys are deleted. Every `var(--token, <Classic fallback>)` loses its dead fallback; tokens that only existed to switch Classic off (transparent borders, hidden dividers, 0-width underlines, `--hover-scale: 1`) are deleted with the declarations and markup they hid; single-use tokens are inlined.
  - **Button contrast:** a new **control container** role (blue-100, label blue-900 at 8.5:1) for every tonal control — secondary/outline buttons, close/back circles, tab tracks, nav indicators, tour toggles at rest — one step stronger than the blue-50 card tint, so controls stand off white sheets and tinted cards; on the map they add a shadow. Error text on tints moves to a darker red that holds ≥ 4.5:1 on hover fills.
  - **Expanding action buttons:** the speed dial and the base-map options share one glass pill (label + icon, icons aligned on the trigger's axis) instead of a label chip beside a circle; every map control shares one `.fab-glass` surface (85% vs 90% alpha, grey dividers and hover lifts had drifted). The landscape arc is computed for any item count (the fifth item sat on top of the trigger).
  - **Motion:** menus unfold item by item from where they were opened and close in one fade; the menu trigger's icons turn a quarter while cross-fading; the tab pill glides without overshoot; every remaining hard-coded duration/easing (35 transitions) moves onto the tokens; no hover lifts.
  - **Consistency:** all five tab rows (plus the filter status switch) share one global segmented-control rule instead of five scoped copies; remaining uppercase micro-labels become sentence case; coordinates use Inter's tabular figures instead of a monospace font; sheet content fades out above footers instead of being cut; guided-tour popovers adopt the overlay look and keep a screen-edge gutter.
  - **Fixes found on the way:** unnamed notification switches (axe "label"), two undefined tokens (`--font-size-md`, `--font-weight-normal`), a selected tab losing its color on hover, the German friend-request tab label overflowing; two dead components (`round-action-button`, `base-map-picker`) removed.

Explicitly **not** done: dark mode (still deferred — every remaining literal and the light Swisstopo base map would need a pass), new fonts/weights, layout changes (element *styling* changes in Alpenglow, element *structure* and placement do not), haptics, list-row redesign,. The owner picked Alpenglow in iteration 5, which promoted it to `:root` and removed Classic and the switcher.

## Capabilities

### New Capabilities

_None._ All requirements belong to the existing `design-system` capability.

### Modified Capabilities

- `design-system`: establishes the new visual design language (blue brand, pill buttons, tonal controls, soft shadows, calm motion) as the app's only design; requires consistent element styling, tonal controls that stand off their surface, consistent expanding map menus, smooth navigation motion, WCAG AA text, no needless motion, defined tokens, and motion tokens consumed everywhere; changes the Button convention to filled/tonal/text variants with press feedback; adds a tonal `IconButton` variant for navigation chrome; narrows the documented exceptions to the map controls that wear the shared glass surface; requires the PWA theme color to match the app background.

## Impact

- **Theme files:** `src/app/theme/tokens.css` (new primitives, new semantic tokens, Alpenglow block, reduced-motion block).
- **New files:** `src/core/theme/design-variant.ts` (read/apply/persist), `src/features/user/presentation/components/design-variant-section.vue` (switcher), tests under `test/`.
- **Edited:** `src/main.ts` (apply before mount), `user-profile-sheet.vue` (mount the section), shared components in `src/core/components/` (button, icon button, FABs, bottom sheet, dialog, drawer, snackbar, offline toasts/chip), `map-page.vue` sheet transition, five dialog backdrops, two offline-map sheets, `index.html`, `vite.config.ts` (manifest color), `DESIGN.md`, `en.json` + `de-CH.json`.
- **No new dependencies, no DB / Worker / env changes, no build step.**
- **Iteration 5:** `design-variant.ts` and its test, `round-action-button.vue`, `base-map-picker.vue` deleted; the switcher's i18n keys removed; one new key (`friendships.requestsTab`).
- **Comparison path:** the PR preview deploy (`<branch-slug>.tourenbuddy.pages.dev`) lets the owner try it on a phone against prod before merging.
