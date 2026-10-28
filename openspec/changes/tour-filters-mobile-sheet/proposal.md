# Proposal

## Why

The tour-list filters shipped in `tour-list-grade-friend-filters` fail on a phone. The panel is an
overlay sized by the list it covers, so a chip that thins the list shrinks the panel to a sliver:
nested scrollers, options pushed out of reach, a sheet that cannot be dragged past its shrunken
content. Grade ranges (tap, tap again to widen) read as a bug, the Friends tab offers a partner
filter nobody asked for, and the contact detail's "Show tours" carries a map-pin icon that says
"place", not "tour". An independent UX review (mountain-athlete persona) confirmed all of it.

## What Changes

- **Filters are a view of the sheet, not an overlay**: open, they replace the rows in the sheet's
  normal flow — one scroller, sized by the filter groups alone, so tapping a chip never resizes
  the panel or moves a chip. On a phone the sheet opens them at up to 70% of the viewport and can
  be dragged to 90%; dragging never closes them.
- **Footer actions in the thumb zone**: "Reset" (disabled while nothing is set) and
  "Show N tours" (closes the filters) sit in the sheet footer at every scroll position. The pinned
  count/clear row and the pointer-outside dismissal go away.
- **Additive grades**: each grade chip toggles on its own; a tour passes when any part of its grade
  is selected. No ranges.
- **Friends tab filters by recorded-by only**: the partner filter (and its "Me" chip) is gone there.
- **A held list sheet stays draggable**: while search or filters hold the tour list's height, drags
  and snap keys reach each snap's full height however few rows match.
- **Glove-sized targets** in the filter panel (44px chips, date fields and status segments) and
  aligned grade columns that never wrap.
- **Contact detail**: "Show tours" uses the `route` icon.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tour-list-view`: filters view replaces the overlay (presentation, footer, dismissal, a11y),
  additive grade filter, Friends tab recorded-by only.
- `bottom-sheet`: a held fit-content sheet's drags and snap keys reach full snap heights.
- `responsive-overlay`: the tour list sizes for its open filters (70% / 90%).
- `contacts`: the "Show tours" action's icon.

## Impact

- Frontend only. Code: `core/components/bottom-sheet.vue`, `features/tours` (grade model,
  `use-tour-filters`, filter panel, list sheet, `use-friend-people-options` →
  `use-friend-owner-options`), `features/contacts` (detail view). Locales `en.json`, `de-CH.json`.
- The guided tour does not target the filter panel; unaffected.
