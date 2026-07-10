## Why

TourenBuddy is a planning tool where the temporal dimension of a tour (its
season and its planned date) is first-class, yet today those attributes are only
visible buried inside each tour's detail sheet. There is no way to see planned
tours laid out over time. This change adds a calendar surface that gives users a
temporal overview of their tours — the first of three sub-issues under the
umbrella "Calendar & availability" epic (#20). It delivers #240 only: a
read-only calendar view. Availability editing (#242) and friends' availability
(#244) build on the same surface in follow-up changes.

## What Changes

- New **`/calendar`** route hosting a full-screen calendar page (mobile **and**
  desktop), reached from a new calendar icon button in the tour-list overview
  header. The page is a self-contained shell (no map chrome) with its own
  **left sidebar navigation on desktop** / **bottom nav bar on mobile** switching
  between two views (**Planned** and **Seasons**), and a **top app bar** whose
  back arrow returns to the tour-list view on the map page.
- The two views (per mockups in #240):
  - **Planned** (default view) — a **month/week calendar** plotting tours on
    their `plannedDate`. Month view is a 7-column, Monday-start, 6-week grid with
    adjacent-month days dimmed; each tour renders as a primary-colored rounded
    pill with its type icon and (truncated) name. The top app bar shows the
    current month with prev/next chevrons (unbounded paging). Shows the user's
    **own** planned tours **plus friend tours where the user is a marked
    partner** (`isPartner`). Tours without a planned date do not appear.
  - **Seasons** — a Gantt-style chart: a `240px` tour-label column + **4 season
    columns** (`Winter DEC–FEB → Spring MAR–MAY → Summer JUN–AUG → Fall
    SEP–NOV`), with a scrollable list of the user's **own** tours. Each row draws
    one bar per **contiguous run** of tagged seasons (adjacent seasons merge into
    a single spanning bar; non-contiguous runs stay separate; untagged gaps are
    never bridged); zero seasons renders an italic "No seasons scheduled". Each
    row carries the tour name + type icon + type label.
- Selecting a tour in either view navigates to `/map`, selects the tour, and
  opens the tour-detail overlay, **remembering the originating view**.
  - The detail view's **back** button returns to `/calendar` on the same view.
  - **Dismissing** detail (close button or map click) drops the origin and
    lands on the plain map — it does **not** return to the calendar.
- The month/week grid is **hand-rolled** to match the mockup and keep full
  per-cell control for #242/#244; a calendar library is an explicit fallback only
  (see `design.md`).
- **Out of scope for #240 (layout leaves room for them):** green day-shading and
  the "Edit Availability" action (#242); friend contact chips + "+N more" on
  calendar days (#244).
- All user-facing strings added to `en.json` and `de-CH.json`.

This change is **read-only**: it introduces no new tables, no writes, and no
availability concept. It reads existing `plannedDate`, `seasons`, and the
existing `friendTours`/`isPartner` data.

## Capabilities

### New Capabilities
- `calendar-view`: The `/calendar` route + nav shell (sidebar/bottom-nav), its
  two views (Planned month/week calendar + Seasons Gantt), the tour data each
  view displays, and the cross-route navigation contract between the calendar and
  the map's tour-detail overlay (entry, tour selection, back-to-calendar vs
  dismiss-to-map).

### Modified Capabilities
- `tour-list-view`: The tour-list overview header gains a calendar icon button
  that navigates to `/calendar`.

## Impact

- **Routing**: new `/calendar` route in `src/app/router/index.ts`
  (`requiresAuth` + `requiresCompleteProfile`). Cross-route handoff to the map
  page's `activeOverlay` state machine (open tours list on return; select tour +
  carry calendar origin) via a transient `pendingIntent` on `map-store`; active
  view is a `?view=` query param.
- **New feature module**: `src/features/calendar/` (presentation-only; reads the
  existing tours + friendships stores — no new domain/data layer, no repository).
- **Modified**: `tour-list-sheet.vue` (add header button), `map-page.vue`
  (consume return/selection intent; generalize the existing `tourOpenedFromList`
  origin into a `list | calendar-seasons | calendar-planned` origin so the
  info-sheet back button routes correctly), `tour-info-sheet.vue` (back target
  driven by origin).
- **Dependencies**: none required — the month/week grid is hand-rolled to match
  the mockup (date math via `Intl` + `Date`). A calendar library remains a
  documented fallback only if the hand-rolled week view / paging proves costly
  (see `design.md`); it must not compromise mockup fidelity or #242/#244 custom
  cells.
- **i18n**: new keys in `src/locales/en.json` + `src/locales/de-CH.json`.
- **No database, no migration, no Worker changes.**
