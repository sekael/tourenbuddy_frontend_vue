## Context

### The pill

`tour-action-bar.vue` renders a fixed-position capsule at the bottom of the map with two
segments and a divider:

```
.pill  (position: fixed, height: 52px, display: flex, align-items: stretch)
 ├─ BaseTooltip → span.tooltip-wrapper   ← stretches to 52px (flex item)
 │    └─ button.segment                  ← centered at content height (~24px)
 ├─ div.divider                          ← align-self: stretch, so full height
 └─ BaseTooltip → span.tooltip-wrapper
      └─ button.segment
```

`.pill` sets `align-items: stretch`, so each `.tooltip-wrapper` does fill 52px. But
`.tooltip-wrapper` itself sets `align-items: center` (`base-tooltip.vue:159-163`), which
applies to *its* child — the `<button>` — and the button has no `height`. It therefore
sizes to its content and sits centered, leaving ~14px of wrapper exposed top and bottom.

That exposed strip looks like the button (same background, inside the same rounded
capsule) but is a `<span>` carrying only the tooltip's hover/touch handlers. Tapping it
does nothing. The `.divider` is the giveaway that the intended layout was full-height: it
explicitly sets `align-self: stretch` and does span the pill.

Note also that the wrapper *does* receive `@click` (`base-tooltip.vue:113`), but that
handler only dismisses the tooltip bubble; it does not forward the action.

### The crosshair

`crosshair.vue` is a 40×40 SVG: four line segments with a gap at the centre, plus a centre
dot, all painted from `currentColor`, with `.crosshair { color: var(--color-accent) }`.
It is `pointer-events: none` and centered over the map by its wrapper.

`<Crosshair />` is rendered in exactly one place: `location-picker.vue:47`. A repo-wide
search for "crosshair" also hits `offline-region-draw.vue:197,207` and
`tour-info-sheet.vue:425`, but those are the CSS `cursor: crosshair` keyword and a prose
comment — not the component.

The theme has no dark mode: `tokens.css` contains no `prefers-color-scheme` block and no
`.dark` class. Available red primitives are `--red-600: #dc2626` (exposed as
`--color-error`) and `--red-700: #c62828` (exposed as `--color-route-end`).

## Goals / Non-Goals

**Goals**
- Every pixel that visually belongs to a pill segment activates that segment.
- The crosshair remains legible over any Swisstopo terrain — glacier, snow, rock, forest,
  water — without the user hunting for it.
- Fix both without expanding any shared component's API or behaviour.

**Non-Goals**
- No redesign of the pill: same size, same layout, same 52px height, same divider.
- No change to `BaseTooltip`'s centering for other call sites.
- No crosshair variant/colour prop — one render site means one appearance.
- No animation, pulse, or shadow on the crosshair.
- No new design token.

## Decisions

### D1 — Fix the hit area at the call site, not in `BaseTooltip`

`.segment` gains `align-self: stretch` in `tour-action-bar.vue`'s scoped styles.

- *Why the call site?* `BaseTooltip`'s `align-items: center` is correct for its other
  users, which wrap icon buttons in ordinary inline flow where centering is what you want.
  Changing it globally would alter vertical alignment for every tooltip in contacts, tour
  sheets and map controls, to fix a defect that only manifests inside a stretch container.
  The regression surface of the global change is larger than the bug.
- *Why this is still a root-cause fix and not a symptom patch:* the root cause is "the
  button does not fill the pill", and this is the one place the pill exists. There is no
  sibling caller left broken — every other `BaseTooltip` consumer was checked and none
  slots a button into a stretch-aligned flex container.
- *Why `align-self: stretch` rather than `height: 100%`?* `align-self` is the property
  that actually overrides the parent's `align-items`; `height: 100%` would resolve against
  a wrapper whose height is itself flex-derived, which is the fragile form. It also mirrors
  what `.divider` already does two rules below, so the file stays internally consistent.
- *Why not drop `BaseTooltip` and put the tooltip on the pill?* The two segments have
  different tooltip text, and the add-tour tooltip is dynamic (`addTourTooltip` prop). One
  tooltip cannot serve both.

### D2 — Two-pass stroke for the crosshair, not a `filter`

The geometry is defined once and painted twice: a white pass at a wider `stroke-width`
underneath, then the red pass at the current width on top. The centre dot gets the same
treatment via its own fill/stroke pair.

- *Why a halo at all, when the issue says "change blue to red"?* The issue's stated
  problem is visibility on glacial and rocky terrain, and red is its proposed remedy. Red
  fixes glacier and snow, and makes rock worse — Swisstopo renders scree and rock faces in
  warm red-browns, and the hillshade darkens them further. A single hue cannot be
  simultaneously distinct from cool blues and warm browns. A light/dark edge pair is
  distinct from both, because it supplies its own local contrast regardless of the
  backdrop. Delivering the user's stated *goal* means red **plus** the halo.
- *Why not `filter: drop-shadow(...)`?* It is one line, but it rasterizes the SVG on the
  compositor. On the map this element sits over a continuously repainting WebGL canvas,
  and a blurred shadow reads as a soft smudge rather than a crisp edge at 40px — the
  opposite of the precision a goal-placement reticle needs. A hard second stroke stays
  sharp at any zoom or DPR.
- *Why define the geometry once rather than duplicating five elements?* Duplicating the
  four lines and the circle means ten elements whose coordinates must stay in sync by
  hand; a later tweak to the crosshair's proportions silently desynchronizes the halo from
  the mark. Defining the shape once in `<defs>` and referencing it twice with `<use>`
  keeps a single source of geometry, and the two passes then differ only in stroke colour
  and width. `<use>` inherits `stroke`/`stroke-width` from the referencing element when the
  referenced geometry does not set them itself — so the geometry must *not* carry its own
  stroke attributes.
- *Why white for the halo, unconditionally?* No dark mode exists, and the crosshair only
  renders over the light Swisstopo basemap. A token or media query here would be
  configuration for a value that never varies.
- *Why the halo stroke must be drawn first:* SVG paints in document order with no
  z-index — the second `<use>` lands on top. Reversing them hides the red mark entirely
  under the white one, which is the likely failure mode when filling this in.

### D3 — `--color-error` for the red

The red pass uses the existing semantic token rather than a raw hex or a new token.

- *Why not a new `--color-crosshair` token?* One consumer. A token indirection for a
  single call site is naming ceremony, not abstraction.
- *Why `--color-error` (`--red-600`) over `--color-route-end` (`--red-700`)?* `--red-600`
  is the brighter of the two and this is a visibility fix. `--color-route-end` also carries
  a specific meaning on the map — the end marker of a GPX track — and reusing it would make
  the reticle read as related to route rendering when it is not.
- *Acknowledged imperfection:* "error" is semantically wrong for a reticle; it names a
  state, not a colour. Accepted over minting a token, because the alternative costs more
  than the mismatch. If a third red consumer appears with a non-error meaning, that is the
  moment to introduce a proper colour token.

### D4 — Test the geometry contract, not the pixels

The existing `tour-action-bar.test.ts` gains cases in the failure/edge spirit of
`.claude/testing.md`. What is assertable in happy-dom is limited: it does not perform
flexbox layout, so `getBoundingClientRect()` returns zeros and "does the button fill 52px"
cannot be asserted there.

- *What is asserted:* that a click landing on the `.tooltip-wrapper` — the element that
  used to swallow taps — reaches the segment's handler, and that a disabled segment still
  emits nothing when its envelope is clicked. The second case is the regression that a
  careless fix (forwarding clicks from the wrapper) would introduce.
- *What is not asserted:* computed heights and anything visual. Those go in the manual
  checks, which are the real acceptance evidence.
- *No test for the crosshair's appearance.* Asserting that an SVG has two `<use>` elements
  tests the implementation, not the outcome; the outcome is "can a human see it over ice",
  which only an eye can judge.

## Risks / Trade-offs

- **A full-height segment enlarges the hover highlight.** `.segment:hover` paints a
  background across the now-taller box, so the hover affordance changes shape slightly.
  This is the intended effect — the highlight now truthfully shows what is clickable —
  but it is a visible difference from today and should be eyeballed at desktop width.
- **The wider white stroke thickens the crosshair's visual footprint** by the halo width
  on each side, making it marginally heavier over the map and occluding a few more pixels
  of terrain at the centre. Accepted: the mark is 40px on a full-screen map, and being
  seen is the entire point.
- **`<use>` + inherited stroke is the less familiar SVG form.** It is correct and well
  supported, but a reader unfamiliar with `<use>` inheritance may not realize the geometry
  must be attribute-free for the pattern to work. Mitigated by a comment in the file.
- **`--color-error` naming mismatch** (D3). Live and accepted.

## Migration Plan

Single PR, client-only. No migration, no Worker deploy, no env var, no feature flag, no
rollout gate. Both changes are presentational and take effect on the next deploy; reverting
is a straight revert of the commit.

## Open Questions

None. The crosshair treatment (red + halo over plain red), the decision to keep the fix
out of `BaseTooltip`, and the absence of a variant prop were all resolved with the issue
author before this proposal. The initially-assumed "three crosshair call sites" was
corrected during investigation to one, which removed the scope question entirely.
