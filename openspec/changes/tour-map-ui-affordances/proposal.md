## Why

Issue #263 is user feedback on the two map interactions that start every tour: opening
the tour list, and dropping a new goal. Both fail for the same underlying reason — the
thing the user aims at is smaller or less visible than it appears.

**The pill's tap targets are smaller than the pill.** `tour-action-bar.vue` renders each
segment as a `<button>` slotted into `<BaseTooltip>`. `.tooltip-wrapper`
(`base-tooltip.vue:159-163`) is `display: inline-flex; align-items: center`. As a flex
item of the 52px `.pill` it stretches to full height, then *centers* the button inside at
content height (~24px). The result is roughly 14px of dead pill above and below each
segment: visually part of the button, but a `<span>` with no click handler underneath.
The user's report — "only responsive when clicking on the text/icon, not the envelope" —
is exactly this geometry. It is worst on touch, where the finger's contact point is
imprecise and the pill sits at the bottom edge of the screen.

**The crosshair is tinted the one hue Swisstopo uses most.** `crosshair.vue:67` sets
`color: var(--color-accent)` — blue. The Swisstopo basemap draws water, glacier polygons,
crevasse hatching, and contour shading in blues and cool greys. A thin blue crosshair over
a glacier is close to invisible, which is precisely the terrain where placing a goal
accurately matters most.

## What Changes

- **Pill segments fill their envelope** (`tour-action-bar.vue`): `.segment` stretches to
  the full 52px pill height so the entire visual surface of each segment is the hit target.
  Scoped to this component — `base-tooltip.vue` is not touched.
- **Crosshair becomes red with a white halo** (`crosshair.vue`): the geometry is drawn
  twice — a wide white stroke underneath, the red stroke on top. Contrast then comes from
  the light/dark edge pair rather than from the hue, so the mark reads on snow, glacier
  ice, dark rock and forest alike. The issue asks for red; red alone would trade
  invisible-on-glacier for invisible-on-red-rock, so the halo is what actually delivers
  the requested outcome.
- **Not changed**: `base-tooltip.vue`, the `Crosshair` component's API (no new prop), any
  i18n key, any store, route, or schema.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `map`: the tour action bar's hit region becomes the full segment envelope rather than
  its content box, and the location-picker crosshair's contrast becomes terrain-independent.

## Impact

- **Code**: two files — `src/features/map/presentation/components/tour-action-bar.vue`
  (CSS only) and `src/core/components/crosshair.vue` (template + CSS). Plus one test file
  extended (`test/features/map/presentation/components/tour-action-bar.test.ts`).
- **Blast radius of the crosshair change**: `<Crosshair />` has exactly **one** render
  site — `location-picker.vue:47`, the tour-goal picker named in the issue.
  `offline-region-draw.vue` and `tour-info-sheet.vue` match the string "crosshair" only as
  a CSS `cursor` keyword and in a comment; they do not render the component. So the change
  is inherently scoped and needs no variant prop.
- **Backend / DB**: none. No migration.
- **Worker**: none. No `wrangler deploy`.
- **Env / CI**: none.
- **i18n**: none — no user-facing string added or changed.
- **Theme**: no new token. The app has no dark mode (`tokens.css` defines no
  `prefers-color-scheme` block), and the crosshair only ever renders over the light
  Swisstopo basemap, so a fixed white halo is unconditionally correct.
- **Verification**: the hit-area fix is assertable in Vitest via computed layout only
  weakly (happy-dom does not lay out flexbox), so its acceptance evidence is a manual
  check — tapping the top and bottom edge of each segment. The crosshair change is purely
  visual and is verified by eye over glacier and rock tiles.
