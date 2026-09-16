## Why

The tour filters panel currently renders inline, between the sticky header and the tour rows. Two problems follow from that placement:

- **It scrolls away.** The panel is part of the list's scroll flow, so it is tall enough to push its own controls off screen. The current mitigation — pinning the trigger row at the top of the scroll region — is what forced `.list-header` into `position: sticky` with a three-declaration offset trick to cancel the scroll container's top padding.
- **It displaces the results.** Expanding filters pushes the rows down, so the user cannot see the effect of a filter while choosing it without scrolling past the panel.

Making the panel an overlay over the list region decouples the two concerns: the header stays put because it is no longer inside the scroller, and the panel occupies a fixed region with its own scrollbar instead of competing with the rows for scroll position.

The header also spends more vertical space than it needs. Search and the filter trigger each occupy a full row; merged into one row they free roughly 40px — material on a bottom sheet capped at 70% of viewport height.

Covering the list completely introduces one problem the inline layout did not have: the user filters blind. A live match count inside the panel replaces the feedback the visible rows used to provide.

## What Changes

- **Header layout**: the search input and the Filters trigger merge into a single row. Header becomes: tabs → `[search field | Filters button]`.
- **Backfill entry point**: the "Review tour overlaps" button leaves the list header and becomes an icon button in the shell's `header-actions` slot, shown on the Friends tab when the user has friends.
- **Filter panel presentation**: `TourFiltersPanel` moves out of the scroll flow and renders as an overlay absolutely positioned over the tour list region only. It does not cover the tabs, the search/filter row, or the shell header. Both shells get the overlay — one code path, not a per-breakpoint layout.
- **Panel scrolling**: the panel scrolls internally within the list region's height, with `overscroll-behavior: contain` so scrolling past its end does not chain to the list or the map behind. The bottom sheet is never auto-resized or re-snapped when the panel opens.
- **Pinned summary row**: a row at the top of the panel's scroll region shows the live match count and, when at least one filter is active, the Clear filters control. The count reflects search *and* filters, so it states exactly what the list will show on collapse.
- **Dismissal**: the Filters trigger toggles as today; additionally Escape and a pointer-down outside dismiss it. The tabs, search field, and trigger count as part of the panel's surface — interacting with them does not dismiss, so search can be refined while filters are open.
- **Animation**: the panel slides down from under the search row, echoing the inline expand it replaces, and appears instantly under `prefers-reduced-motion`.
- **Scroll ownership**: the tour list gets its own scroll container instead of relying on the shell's. This is the structural precondition for an overlay that does not scroll with the list, and it retires the `position: sticky` treatment on `.list-header` along with its `--surface-pad-top` compensation.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `tour-list-view`: filter panel presentation, header composition, search/trigger row merge, backfill entry point placement, and list scroll ownership within the tour list sheet.

> Originally filed against `tours`. That was wrong — `openspec/specs/tours/spec.md` covers realtime synchronization and atomic write RPCs, while every requirement this change touches (`Tours list overlay`, `Tour search by name and partner`, `Filter UI density`, `No-results state and clear filters`) lives in `tour-list-view`.

## Impact

- **Components**: `tour-list-sheet.vue` (header markup, scroll structure, overlay host, dismissal wiring, header-actions icon), `tour-filters-panel.vue` (own scroll region, pinned summary row).
- **Filter state**: none. `use-tour-filters` keeps its per-tab namespacing, `activeFilterCount`, `filteredTours`, `clearFilters`, and `clearAll` unchanged — this change is presentation only. `filtersExpanded` stays a local ref, so the panel is closed after a remount while the filter selection survives.
- **Shells**: no API change to `BottomSheet` / `SideDrawer`. `--surface-pad-top` stays published by both (inert here, but it documents the padding contract for any future sticky consumer); only `.list-header`'s consumption of it goes away.
- **Bottom sheet sizing**: `:fit-content="!isDesktop"` makes the sheet measure natural content height. Investigation suggests this survives a height-filling list — `openAtNaturalHeight` sets the *sheet* to `height: auto`, leaving `.content` indefinite, against which a percentage height on `.list-view` resolves to `auto`. Still requires browser confirmation before the rest of the work.
- **Existing tests**: four tests in `test/features/tours/presentation/components/tour-list-sheet.test.ts` target `.filters-trigger` and `[data-testid="clear-filters"]` and need updating for the relocated control.
- **i18n**: one new pluralized key for the match count, plus reuse of `tours.list.filtersBtn`, `tours.list.clearFiltersBtn`, and `tours.list.viewBackfillCollisionsBtn`. One new key for the panel's accessible name.
- **Backend / DB**: none.
