## Context

`tour-list-sheet.vue` renders inside two shells — `BottomSheet` on mobile, `SideDrawer` on desktop — chosen at runtime via `<component :is="isDesktop ? SideDrawer : BottomSheet">`. Both shells own the scroll region: `.content` (`bottom-sheet.vue`) and `.drawer-content` (`side-drawer.vue`) are the elements with `overflow-y: auto`, and everything slotted in is tall content inside them.

That single fact is what makes the current design awkward. Because the shell scrolls, anything the list wants to keep on screen has to be `position: sticky`, and sticky inside a padded scroll container resolves against a constraint rectangle inset by that padding — which is why `.list-header` currently carries a `top` / `margin-top` / `padding-top` trio built on `--surface-pad-top` just to sit flush against the shell header.

An overlay cannot be built on that structure. `position: absolute` inside a scrolling ancestor scrolls with the content; only `sticky` and `fixed` escape, and neither can be sized to the scrollport in CSS without hardcoding heights. The overlay requirement therefore forces the scroll ownership question.

## Goals / Non-Goals

**Goals**

- Filter panel renders over the tour rows, not in their scroll flow, and stays put while the rows sit underneath.
- Panel scrolls internally, bounded by the list region, with no scroll chaining.
- Header (tabs + search/filter row) stays visible without `position: sticky`, and stays interactive while the panel is open.
- Live match count so filtering is not blind.
- Dismissal via trigger, Escape, and outside pointer-down, with focus returning to the trigger.

**Non-Goals**

- No change to filtering logic, `use-tour-filters`, or per-tab namespacing.
- No auto-resize or re-snap of the bottom sheet when the panel opens.
- No focus *trap*. Tabs and search remain reachable; this is a non-modal popover, not a dialog.
- No persistence of the open/closed state across remount.
- No change to the shells' public API.

## Decisions

### Decision 1: Move scroll ownership from the shell to the list

`.list-view` fills the shell's content box and becomes a flex column: the header at natural height, then the list region taking the remainder.

```
.list-view            height: 100%; display: flex; flex-direction: column
├── .list-header      flex-shrink: 0          ← plain flex item, no sticky
└── .list-region      flex: 1; min-height: 0; position: relative; overflow: hidden
    ├── .tours-scroll overflow-y: auto        ← rows, empty states, loading
    └── .filters-overlay  position: absolute; inset: 0   ← v-if="filtersExpanded"
```

The shell's own scroller then has nothing to scroll and becomes inert.

**Why this over the alternatives:**

- *Sticky overlay sized to the scrollport* — CSS cannot express "height of my scrollport" without container queries on the shells, which would mean changing both. More coupling, worse result.
- *Teleport to body with a fixed-position panel* — would have to track the sheet's animated height and drag position to stay aligned. Re-implements what the DOM already gives us.

`min-height: 0` on the list region is load-bearing: a flex child's default `min-height: auto` refuses to shrink below content size, which would push the scroller past the shell instead of scrolling inside it. `overflow: hidden` on the same element is what clips the slide-in animation (Decision 6).

**Consequence worth stating plainly:** this deletes the `position: sticky` / `top` / `margin-top` / `padding-top` block on `.list-header`. The header is pinned because it is *outside* the scroller, which is the structurally honest version of what sticky was faking.

### Decision 2: The overlay covers the list region, in both shells

`.filters-overlay` is `position: absolute; inset: 0` within `.list-region`, so its bounds are exactly the rows area. The header is a sibling above it and is never covered.

Both shells get this. The desktop drawer has more height and the inline panel was more tolerable there, but a per-breakpoint layout would mean two structures, two dismissal rule sets, and a doubled test matrix — with `isDesktop` escalating from "which shell renders" to "what shape the feature has". Consistency wins.

The overlay is opaque (`--color-background`), not a scrim over visible rows. A translucent overlay would leave tour names bleeding through the filter chips — the same legibility failure this component already fixed three times in its header.

### Decision 3: Pinned summary row — count plus conditional Clear

`TourFiltersPanel` gains internal structure it does not have today:

- The panel root scrolls (`overflow-y: auto`, `overscroll-behavior: contain`).
- A summary row sits at the top with `position: sticky; top: 0`, opaque background, and a `z-index` above the chips.

The row is **always rendered** — it carries the live match count. The Clear filters control appears inside it only when `activeFilterCount > 0`.

The count is `filteredTours.length`, which applies search *and* filters. It is a literal promise of what the list shows on collapse. The alternative — counting filters only — is more predictable as you tap chips but disagrees with reality whenever a search is active. That disagreement is the worse failure, and it is avoidable here precisely because the search box stays visible above the panel, so an active query is never hidden context.

Sticky is correct *here*, unlike the header case: this element genuinely lives inside its own scroll flow and must stay visible as filter groups scroll past. Note the panel's scrolling root must carry no top padding — put padding on an inner wrapper, or the padding-inset constraint rectangle from `.list-header` recurs.

`overscroll-behavior: contain` matters more than usual: without it, flicking past the end of a short filter list chains to the sheet drag and the map behind it.

### Decision 4: Dismissal scope and focus

The tabs, search field, and filters trigger count as **part of the panel's interactive surface**, not as "outside". Tapping search focuses it with the panel still open; tapping a tab switches tabs with the panel still open. "Outside" means the shell header (title, calendar, add-tour, close) or anything beyond the sheet.

Without this carve-out the two approved requirements contradict each other: an overlay covering the whole list region leaves nothing *but* the header to tap, so a literal outside-tap rule would make "search stays interactive" unreachable.

- **Trigger**: unchanged toggle, gains `aria-expanded` and `aria-controls`.
- **Escape**: `@keydown.escape` on `.list-view`, **not** on the panel root. Focus may legitimately sit in the search input, which is a sibling of the panel — a listener on the panel root would never see the event. `.list-view` is the nearest common ancestor. Precedent for the local-listener approach over a global one: `base-tooltip.vue:115`.
- **Outside pointer-down**: a `document` `pointerdown` listener registered only while expanded, removed on collapse and in `onUnmounted`. `pointerdown` rather than `click` so a drag starting outside dismisses immediately. The header subtree and the trigger are both excluded, the trigger specifically so its own click cannot close-then-reopen in one gesture.
- **Focus**: move focus to the panel root (`tabindex="-1"`) on open; return it to the trigger on close, for all three dismissal paths. Returning focus is the part that gets skipped and the part keyboard and screen-reader users actually notice.

Semantics: `role="region"` with `aria-label`, not `role="dialog"`. Content outside stays operable, so `dialog` would misreport what is reachable.

### Decision 5: Search and trigger share a row; backfill moves to the shell header

The search field flexes to fill; the Filters button sits at the end with `flex-shrink: 0`, keeping its `activeFilterCount` badge. The row does not wrap at narrow widths — the input shrinks instead, since a wrapped two-line row would give back the space this merge reclaims.

The "Review tour overlaps" button moves out of the list header into the shell's `header-actions` slot as a `BaseIconButton`, still conditional on the Friends tab and `hasFriends`. This keeps the list header at two rows on both tabs, so the list region does not change height when switching tabs. The `sync_alt` icon is already in the registry (it is the icon on the current button), so no registry addition is needed; `tours.list.viewBackfillCollisionsBtn` becomes the `aria-label`, wrapped in `BaseTooltip` on desktop to recover the label text the icon drops.

### Decision 6: Slide down from the header

The panel enters with `transform: translateY(-100%)` → `0`, clipped by `overflow: hidden` on `.list-region`, so it reads as coming out from under the search row — preserving the spatial explanation the inline expand used to provide for free. Under `prefers-reduced-motion: reduce` the transition is dropped and the panel appears instantly. Both `<Transition>` and reduced-motion queries have precedent in this codebase.

## Risks / Trade-offs

- **`fit-content` sizing on mobile.** `openAtNaturalHeight` (`bottom-sheet.vue:185`) sets `el.style.height = 'auto'` on the *sheet*, then measures `offsetHeight`. With the sheet indefinite, `.content` is indefinite too, so a percentage height on `.list-view` resolves to `auto` and natural measurement still reports content height; once the sheet has a definite height it resolves normally. The mechanism appears self-correcting, but this is reasoning from spec, not observation — it gets a browser check before the rest of the work, with `min-height: 100%` or dropping `fit-content` as fallbacks.
- **Nested scroll regions on touch.** The panel scroller sits inside a shell scroller that is now inert but still `overflow-y: auto`. `overscroll-behavior: contain` is what stops a flick chaining outward; without it this regresses into the map-pan-behind-the-sheet bug class.
- **Transform over a scrollable region.** The slide animates a container that owns a scroller. Cheap on modern engines, but it is the one part of this change with a plausible low-end-device cost, and the reduced-motion path is the escape hatch.
- **Retiring sticky removes a workaround that took several attempts to get right.** The `--surface-pad-top` trio goes not because it was wrong but because the structure it compensated for is going away. The property stays published so a future sticky consumer does not rediscover the padding-inset rule the hard way.

## Migration Plan

Single-step, presentation-only, no persisted state — no migration or feature flag. Filter values, tab selection, and search text survive because `use-tour-filters` is untouched.

## Open Questions

_(none — resolved during review)_

Resolved: outside-tap scope (header is inside), live count (pinned row, search-inclusive), overlay on both shells, backfill placement (shell header icon), expanded state not persisted, slide-down animation.
