## 1. Git Setup

- [x] 1.1 Create the feature branch from latest main:
  `git fetch origin && git checkout main && git pull && git checkout -b feat/240-calendar-view-planned-tours`

## 2. Icons + scaffold checkpoint

- [x] 2.1 Register any missing icons in `src/core/components/icons.ts` used by the
  mockups. **No new icons needed** — reused existing `calendar_today`, `wb_sunny`,
  `chevron_left`, `chevron_right`, `arrow_back`, plus `TOUR_TYPE_ICONS` for pills/rows.
- [x] 2.2 Prove the hand-rolled month grid: `buildMonthGrid` in
  `calendar-dates.ts` (Monday-start, 6-week/42-cell, `Date` math), covered by
  `calendar-dates.test.ts`. Day cells host arbitrary content (pills → the
  #242/#244 seam). Grid proved out; no library fallback needed.

## 3. Routing + cross-route handoff

- [x] 3.1 Add the `/calendar` route in `src/app/router/index.ts` (lazy-loaded,
  `requiresAuth + requiresCompleteProfile`).
- [x] 3.2 Add an ephemeral `pendingIntent` to `map-store`
  (`{ openTours?, selectTourId?, origin?: 'cal-seasons' | 'cal-planned' }`)
  with `setPendingIntent` / `consumePendingIntent` (read-once).
- [x] 3.3 In `map-page.vue`, consume and clear `pendingIntent` in `onMounted`
  after `loadTours()` — opens the tours overlay and/or selects the tour + sets
  the detail origin (mirrors `pendingFlyTo`).
- [x] 3.4 Generalize `tourOpenedFromList` → `tourDetailOrigin`
  (`'list' | 'cal-seasons' | 'cal-planned' | null`); `show-back` driven off it;
  `handleTourInfoBack()` routes on origin (`'list'` → tours overlay; `'cal-*'` →
  `router.push({ name: 'calendar', query: { view } })`).
- [x] 3.5 Dismiss paths (`closeOverlay`, map-background click) clear the origin
  so no calendar return is offered.

## 4. Calendar shell (nav + top bar)

- [x] 4.1 `calendar-page.vue`: no map chrome; left sidebar (desktop) collapsing
  to bottom nav (mobile) via `calendar-nav.vue`; top app bar with back control
  (`pendingIntent.openTours` → `/map`). Active view bound to `?view=`
  (default `planned`, not persisted).
- [x] 4.2 Planned top bar: current month label + prev/next chevrons (unbounded).
  Seasons top bar: static title.
- [x] 4.3 Calendar icon button in `tour-list-sheet.vue` `#header-actions`
  (`BaseIconButton name="calendar_today"`) → `/calendar`.

## 5. Seasons view (hand-rolled Gantt)

- [x] 5.1 `seasons-gantt.vue`: `240px` label column + 4 season columns
  (Winter/Spring/Summer/Fall with month ranges), scrollable owned-tour list
  (`toursStore.tours`). Row = name + type icon + type label. Design tokens.
- [x] 5.2 Bar rendering: `seasonRuns()` in `season-runs.ts` computes contiguous
  runs (implemented by the user — left→right scan extending only the last run);
  the row template renders one bar per run via `grid-column` span, italic
  empty-state otherwise.
- [x] 5.3 Whole row is the click target → `pendingIntent = { selectTourId,
  origin: 'cal-seasons' }` + navigate to `/map`.

## 6. Planned view (hand-rolled calendar)

- [x] 6.1 `planned-calendar.vue`: **month view** — 7-col Monday-start 6-week
  grid, adjacent-month days de-emphasised, localized weekday headers. Current day
  highlighted (darker tile outline + light tint); "Today" control in the top bar
  returns to the current month. **Week view dropped** (product decision — month
  only for #240). No view-mode persistence.
- [x] 6.2 Feeds own planned tours + partner friend tours
  (`friendTours.filter(t => t.isPartner && t.plannedDate)`); pills carry type
  icon + truncated name; friend pills styled via `pill--friend`; overflow to
  `+N more` past a 2-pill cap.
- [x] 6.3 Pill tap → `pendingIntent = { selectTourId, origin: 'cal-planned' }` +
  navigate to `/map`. Empty-day clicks inert (no handler on the cell).

## 7. i18n

- [x] 7.1 New `calendar.*` keys added to `en.json` + `de-CH.json` (nav, back,
  season month-ranges, view titles, empty/overflow states). Season names reuse
  existing `tours.season.*`.

## 8. Tests (edge cases + failure paths)

- [x] 8.1 Seasons: merge / non-contiguous / gaps / no-wraparound covered by
  `season-runs.test.ts`; friend excluded + empty-state covered by
  `seasons-gantt.test.ts`.
- [x] 8.2 Planned: no-plannedDate hidden, non-partner friend hidden, partner
  friend shown, overflow cap — `planned-calendar.test.ts` (passing).
- [x] 8.3 Navigation: `pendingIntent` consume-once — `map-store-pending-intent.test.ts`.
- [x] 8.4 `npm run test`: 1090 pass, 0 fail.

## 9. Finalize

- [x] 9.1 Run `npx eslint . --fix` and `npm run type-check` — both clean.
- [ ] 9.2 Prompt the user to commit (do NOT commit automatically). Suggested:
  `feat(calendar): add calendar view of planned tours and seasons (#240)`
- [ ] 9.3 Prompt the user to push the branch and open a PR to `main` referencing
  #240 (and epic #20).
- [ ] 9.4 Prompt the user to archive this change with `/opsx:archive` once merged.
