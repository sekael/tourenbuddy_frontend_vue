## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/263-tour-map-ui-affordances`

## 2. Pill hit area

- [x] 2.1 `src/features/map/presentation/components/tour-action-bar.vue` — in the scoped `.segment` rule (currently lines 83–93), make the button fill the pill's full 52px height so its entire visual envelope is clickable. Use `align-self: stretch` — the property that overrides `BaseTooltip`'s `align-items: center`, and the same form `.divider` already uses at line 115 (design D1)
- [x] 2.2 Do NOT edit `src/core/components/base-tooltip.vue`. Its `align-items: center` is correct for every other consumer; changing it globally would shift vertical alignment across contacts, tour sheets and map controls to fix a defect that only occurs inside a stretch container (design D1)
- [x] 2.3 Do NOT forward clicks from `.tooltip-wrapper` to the button as an alternative fix — that would fire the action for disabled segments too, since the wrapper has no `:disabled` state (design D4, second test case)

## 3. Crosshair visibility — **your gap** (design D2)

- [x] 3.1 `src/core/components/crosshair.vue` — rewrite the SVG body so the crosshair is drawn in two passes: a wide **white** stroke underneath (the halo), then the red mark on top. Define the geometry **once** in `<defs>` and reference it twice with `<use>`, so a later tweak to the crosshair's proportions cannot desync the halo from the mark
- [x] 3.2 The geometry inside `<defs>` must carry **no** `stroke` or `stroke-width` attributes of its own — `<use>` only inherits those properties when the referenced elements do not set them. Keep `stroke-linecap="round"` on the geometry (it is the same for both passes)
- [x] 3.3 The halo `<use>` must come **first** in document order. SVG has no `z-index`; it paints in document order, so a reversed pair hides the red mark completely under the white one
- [x] 3.4 Set `.crosshair { color: var(--color-error) }` for the red pass (design D3). Do not add a new token, and do not use `--color-route-end` — that red already means "GPX track end marker" on this map
- [x] 3.5 Keep the existing 40×40 `viewBox`, the centre gap, the centre dot, `aria-hidden="true"` on the wrapper, and `pointer-events: none`. The centre dot needs the halo treatment too, or it vanishes against ice while the arms stay visible
- [x] 3.6 Do NOT add a `variant`/`color` prop. `<Crosshair />` has exactly one render site — `location-picker.vue:47` — so there is nothing to branch on (design "Non-Goals")
- [x] 3.7 Do NOT use `filter: drop-shadow(...)` instead. It blurs at 40px over a repainting WebGL canvas, giving a soft smudge where a goal reticle needs a crisp edge (design D2)

## 4. Tests (edge cases + failures only)

- [x] 4.1 `test/features/map/presentation/components/tour-action-bar.test.ts` — add: a click dispatched on the `.tooltip-wrapper` element (the strip that previously swallowed taps) reaches the enclosed segment and emits `tours` exactly once
- [x] 4.2 Add: with `toursDisabled: true`, a click on the segment's envelope emits **nothing** — guards against a fix that forwards wrapper clicks and so bypasses `:disabled` (design D4)
- [x] 4.3 Do NOT assert computed heights or `getBoundingClientRect()` — happy-dom performs no flexbox layout and returns zeros, so such a test asserts the DOM stub, not the fix (design D4)
- [x] 4.4 Do NOT write a test asserting the crosshair's SVG structure — "has two `<use>` elements" tests the implementation, while the actual outcome ("legible over ice") is only judgeable by eye (design D4)
- [x] 4.5 `npm run test` — all pass

## 5. Manual verification (the acceptance evidence for #263)

- [ ] 5.1 `npm run dev`, then on the map tap the **very top edge and very bottom edge** of the "My Tours" segment and of the add-tour segment — both must activate. Before the fix, roughly the outer 14px of each does nothing
- [ ] 5.2 Check on a touch device or with device emulation, since that is where the report originated and where finger imprecision makes the dead strip bite
- [ ] 5.3 Confirm the enlarged `.segment:hover` highlight still looks right at desktop width — it now spans the full pill height rather than the content box (design "Risks")
- [ ] 5.4 Confirm the disabled state still reads correctly: a disabled segment shows the 0.45 opacity and does not respond anywhere in its envelope
- [ ] 5.5 Start a new tour to open the location picker, and pan over each of: a **glacier / snowfield**, a **rock face or scree** (warm red-brown), **forest**, and **water**. The crosshair must stay legible over all four — that spread is the whole point of the halo, and testing only over ice would validate the wrong half of the change
- [ ] 5.6 Verify the crosshair still sits exactly at the map centre and that `getCrosshairCoordinates` (`location-picker.vue:32`) still returns the point under the mark — the SVG rewrite must not shift the visual centre

## 6. Finalize

- [x] 6.1 `npx eslint . --fix` — zero warnings
- [x] 6.2 `npm run type-check` — clean
- [x] 6.3 Prompt user to commit (do NOT commit) with message: `fix(map): full-envelope tap targets on tour pill, high-contrast crosshair (#263)`
- [x] 6.4 Prompt user to push the branch and open a PR to `main`
- [x] 6.5 Prompt user to archive this change with the `openspec-archive` skill
