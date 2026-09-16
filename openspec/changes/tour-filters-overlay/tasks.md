## 1. Git Setup

- [ ] 1.1 Deal with the uncommitted sticky-header and type fixes currently sitting on `main` (`bottom-sheet.vue`, `side-drawer.vue`, `tour-list-sheet.vue`, `tour-info-sheet.vue`, `phone-verification-dialog.vue`) — commit them on their own branch and merge, or stash. Do not carry them into this change's branch as unrelated diff.
- [ ] 1.2 Create the feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/tour-filters-overlay`

## 2. Confirm the `fit-content` interaction first

> Reasoning says this works (see design.md → Risks); this task is to confirm it in a browser before the rest of the work depends on it.

- [ ] 2.1 Prototype `.list-view { height: 100% }` on mobile with `:fit-content="!isDesktop"` still set. Confirm the sheet still opens at a sensible height rather than collapsing or overshooting.
- [ ] 2.2 If it misbehaves, fall back to `min-height: 100%`, or drop `fit-content` for this sheet and use the normal snap points.
- [x] 2.3 Record the outcome in a code comment, including *why* — this is exactly the kind of choice that reads as arbitrary six months later.

## 3. Restructure scroll ownership

- [x] 3.1 Wrap the rows / loading / empty states in `.list-region` (`flex: 1; min-height: 0; position: relative; overflow: hidden`) containing a `.tours-scroll` child with `overflow-y: auto`.
- [x] 3.2 Size `.list-view` per task 2 and make it a flex column with `.list-header` as a non-shrinking first child.
- [x] 3.3 Remove `position: sticky`, `top`, `margin-top`, and `padding-top` from `.list-header`, along with the `--surface-pad-top` comment block explaining them. Keep the opaque background and `z-index`.
- [x] 3.4 Leave `--surface-pad-top` published by both shells — it documents the padding contract for future sticky consumers. Do not delete it as dead code.
- [ ] 3.5 Verify in both shells that rows scroll, the header stays put, and nothing bleeds through the header at any scroll position or snap point.

## 4. Header: merge the row, move the backfill button

- [x] 4.1 Combine `.search-row` and the filters trigger into one flex row: input `flex: 1`, trigger `flex-shrink: 0`, no wrapping.
- [x] 4.2 Keep the `activeFilterCount` badge on the trigger.
- [x] 4.3 Remove the `.filters-row` wrapper and its styles, including the Clear filters button that moves into the panel in task 5.
- [x] 4.4 Move the backfill button into the shell's `header-actions` slot as a `BaseIconButton` using the already-registered `sync_alt` icon, conditional on `activeTab === 'friends' && hasFriends`. Use `tours.list.viewBackfillCollisionsBtn` as the `aria-label`; wrap in `BaseTooltip` on desktop, mirroring how the add-tour button handles its tooltip.
- [ ] 4.5 Check the merged row at the narrowest supported width — the placeholder should truncate, not wrap the trigger onto a second line.
- [ ] 4.6 Confirm the header is the same height on both tabs.

## 5. Filter panel as an overlay

- [x] 5.1 Render `TourFiltersPanel` inside `.list-region` as `.filters-overlay` (`position: absolute; inset: 0`) under `v-if="filtersExpanded"`, opaque `--color-background`.
- [x] 5.2 Give the panel root `overflow-y: auto` and `overscroll-behavior: contain`. Keep padding **off** the scrolling root — put it on an inner wrapper, or the padding-inset constraint rectangle bites the sticky row in 5.3.
- [x] 5.3 Add the pinned summary row: `position: sticky; top: 0`, opaque, `z-index` above the chips. Always rendered, showing the live count from `filteredTours.length`.
- [x] 5.4 Render Clear filters inside that row only when `activeFilterCount > 0`, wired to `clearFilters()` — **not** `clearAll()`, so the search query survives.
- [x] 5.5 Wrap the overlay in `<Transition>`: `translateY(-100%)` → `0`, clipped by the list region's `overflow: hidden`, with the transition dropped under `prefers-reduced-motion: reduce`.
- [ ] 5.6 Confirm the panel covers the rows exactly and never overlaps the header or shell header, in both shells.

## 6. Dismissal and focus

- [x] 6.1 Add `aria-expanded` and `aria-controls` to the trigger; give the panel root a matching `id`, `role="region"`, `tabindex="-1"`, and `aria-label`.
- [x] 6.2 Escape: `@keydown.escape` on `.list-view`, **not** the panel root — focus may sit in the search input, which is a sibling of the panel and whose keydown would never reach it.
- [x] 6.3 Outside pointer-down: `document` `pointerdown` listener registered only while expanded, removed on collapse and in `onUnmounted`. Exclude the header subtree (tabs, search, trigger) and the trigger itself, so header interaction keeps the panel open and the trigger's own click cannot close-then-reopen.
- [x] 6.4 Focus: move to the panel root on open; return to the trigger on close, for all three dismissal paths.
- [x] 6.5 Leave `filtersExpanded` as a local `ref` — the panel is collapsed after a remount by design.

## 7. i18n

- [x] 7.1 Add a pluralized match-count key (e.g. `tours.filters.matchCount`) to `src/locales/en.json` AND `src/locales/de-CH.json`, following the existing three-form convention (`"{count} tour | {count} tour | {count} tours"`, cf. `tours.suggestions.fieldCount`). Call it as `t('tours.filters.matchCount', { count: filteredTours.length })`.
- [x] 7.2 Add the panel's accessible-name key (e.g. `tours.filters.panelAriaLabel`) to both locale files.
- [x] 7.3 Reuse `tours.list.filtersBtn`, `tours.list.clearFiltersBtn`, and `tours.list.viewBackfillCollisionsBtn` as-is.
- [x] 7.4 Run `npm run check:locales` to confirm parity.

## 8. Tests

> Per `.claude/testing.md`: edge cases and failure scenarios, not happy paths. Keep them brief. Filter state is module-level, so reset it between cases — see the existing `withFilter` helper at `tour-list-sheet.test.ts:181`.

- [x] 8.1 Update the four existing tests that target `.filters-trigger` and `[data-testid="clear-filters"]` for the relocated control.
- [x] 8.2 Escape collapses the panel and returns focus to the trigger, including when focus is in the search input.
- [x] 8.3 Pointer-down on the shell header collapses; pointer-down on the search input, a tab, or inside the panel does not.
- [x] 8.4 Activating the trigger while expanded collapses without immediately reopening.
- [x] 8.5 Clear filters resets facets, preserves the search query, and leaves the other tab's filters untouched.
- [x] 8.6 Summary row renders with a count when no filters are active; Clear is absent in that state.
- [x] 8.7 Count equals the rendered row count after collapsing, with a search and a filter both active.
- [x] 8.8 The outside-pointer-down listener is removed on collapse and on unmount (no leak across mount/unmount cycles).
- [x] 8.9 Backfill icon is absent on the owned tab and when the user has no friendships.
- [x] 8.10 Run `npm run test` — all must pass.

## 9. Finalize

- [x] 9.1 Run `npx eslint . --fix` and confirm zero warnings (never `npm run format`).
- [x] 9.2 Run `npm run test` and `npm run type-check`.
- [ ] 9.3 Manually verify both shells: desktop drawer, and mobile sheet at default and expanded snaps. Check the slide animation and its reduced-motion fallback.
- [ ] 9.4 Prompt the user to commit — do not run `git commit`. Suggested message:

      ```
      feat(tours): present tour filters as an overlay over the list

      The filter panel rendered inline in the list's scroll flow, pushing rows
      down and scrolling its own controls off screen. Give the list its own
      scroll container so the header no longer needs sticky positioning, and
      layer the panel over the rows region with internal scrolling, a pinned
      summary row carrying the live match count, and escape / outside-pointer
      dismissal. Search and the filters trigger now share one row, and the
      backfill entry point moves to the shell header.
      ```

- [ ] 9.5 Prompt the user to push the branch and open a PR against `main`.
