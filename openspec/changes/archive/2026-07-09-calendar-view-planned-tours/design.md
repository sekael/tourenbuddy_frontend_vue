## Context

The app is a single `/map` page driven by one `activeOverlay` state machine
(`map-page.vue`). "Tour list" and "tour detail" are overlay states over the map,
not routes; list → detail → back is already tracked by a local
`tourOpenedFromList` boolean and `handleTourInfoBack()`. Tours live in
`tours-store` (`tours` = owned, `friendTours` = shared friend tours, each
carrying an `isPartner` flag). Seasons are an unordered `Season[]`
(`winter | spring | summer | autumn`); `plannedDate` is a single nullable date.
No date/calendar library is currently installed. `openspec/specs/tour-list-view`
governs the list overview; `contact-chip-actions` governs the message/call chip
behavior that #244 will reuse.

This change (#240) is the first of three under epic #20. It is **read-only** and
must leave clean seams for #242 (availability editing: multi-day cell selection +
persistence) and #244 (friends' availability: custom per-day contact chips).

## Goals / Non-Goals

**Goals:**
- A `/calendar` route with two tabs (Seasons Gantt, Planned-tours month/week).
- A navigation contract with the map's detail overlay: back-to-calendar vs
  dismiss-to-map, with the originating tab remembered.
- Pick a calendar library that removes month/week boilerplate **and** can host
  custom day-cell content + multi-day range selection, so #242/#244 extend it
  rather than fight it.

**Non-Goals:**
- No availability model, table, writes, or green-day selection (that is #242).
- No friend contact chips on calendar days (that is #244).
- No changes to how tours are created/edited or to the season data model.
- No new domain/data layer for the calendar — it is presentation-only over
  existing stores.

## Decisions

### 1. Host the calendar as a `/calendar` route (not an overlay)

A dedicated route (chosen by product) gives the full-screen page its own history
entry and a natural deep link. The page is lazy-loaded (`() => import(...)`),
`requiresAuth + requiresCompleteProfile`, consistent with `/map`.

*Alternative considered:* a new `activeOverlay='calendar'`. Rejected per product
direction; it would also overload the map page further and couple the calendar's
lifecycle to the map's WebGL context for no benefit, since the calendar never
shows the map.

### 2. Cross-route handoff: transient intent in the store, tab in the query

Because detail lives on `/map` as overlay state, the calendar must hand three
things across the route boundary:

| Transition | Mechanism |
|---|---|
| Calendar → return to tour list | `router.push({ name: 'map' })` + a transient `openTours` intent the map page consumes on mount |
| Calendar → select a tour | transient intent `{ selectTourId, origin: 'cal-seasons' \| 'cal-planned' }` + `router.push({ name: 'map' })` |
| Detail **back** (origin is calendar) | `router.push({ name: 'calendar', query: { tab } })` |
| Detail **dismiss** (close / map click) | `closeOverlay()`, origin dropped, stay on `/map` |

The **selection/origin is transient UI state**, so it lives in an ephemeral
`pendingIntent` on `map-store` (consumed and cleared in `map-page`'s `onMounted`,
same shape as the existing `pendingFlyTo` deferral) — **not** in the URL, because
`/map?from=cal-planned` deep-linked with no calendar history is meaningless. The
**calendar tab** *is* a query param (`/calendar?tab=planned`) — harmless and
deep-linkable, and it is what the detail back button restores.

*Alternative considered:* everything in query params. Rejected: URL would carry
transient flags that must be scrubbed with `router.replace` after consumption
and would produce nonsensical shareable links.

### 3. Generalize the detail origin

Replace `tourOpenedFromList: boolean` with
`tourDetailOrigin: 'list' | 'cal-seasons' | 'cal-planned' | null`. `show-back` on
the info sheet becomes `origin !== null`; `handleTourInfoBack()` switches on
origin: `'list'` → open tours overlay (today's behavior); `'cal-*'` →
`router.push({ name: 'calendar', query: { tab } })`. This keeps one origin
concept instead of parallel booleans.

### 4. Both views hand-rolled; a calendar library is a fallback only

The #240 mockups (attached to the issue) render the Planned view as a plain
Tailwind **6×7 CSS grid** and the Seasons view as a `240px + repeat(4,1fr)` CSS
grid — both bespoke, neither a widget. That is decisive:

- **Planned (month/week):** hand-rolled grid. A Monday-start, 6-week month grid
  is ~20 lines of `Date` math; `Intl.DateTimeFormat` gives localized month and
  weekday names. This reproduces the mockup exactly and keeps full ownership of
  each day cell — which #242 (multi-day tap/swipe selection) and #244 (contact
  chips + "+N more") need. A library would fight the mockup's custom header,
  sidebar shell, and pill styling, add bundle weight, and gate the hardest
  future features behind its API.
- **Seasons Gantt:** hand-rolled CSS grid, same as the mockup. Each row computes
  **contiguous runs** of tagged seasons over the fixed 4-season axis and draws
  one bar per run (adjacent seasons merge via column span; non-contiguous runs
  stay separate; untagged gaps never bridge). Zero seasons → italic
  "No seasons scheduled".

*Alternative considered:* a calendar library (FullCalendar's `selectable`/
`select` is a nice match for #242's range selection; `dayCellContent` for #244).
Rejected as primary because the mockup is already a simple bespoke grid, and a
library can't reproduce it without heavy theming while still owning the cell.
**Fallback rule:** if hand-rolling the *week* view or month paging proves
disproportionately costly, a library may be introduced for the Planned view
*only* — but it must not compromise mockup fidelity or the custom-cell needs of
#242/#244. The route is lazy-loaded regardless, so any future dep stays off the
critical path.

**Checkpoint (task 2):** confirm the hand-rolled month + week grid renders the
mockup and that a day cell can host arbitrary content (the seam #242/#244 rely
on) before building out both views.

### 5. Data source — read existing stores, no new fetch layer

- Seasons tab: `toursStore.tours` (owned only).
- Planned tab: `toursStore.tours.filter(t => t.plannedDate)` **plus**
  `toursStore.friendTours.filter(t => t.isPartner && t.plannedDate)`.

Both are already realtime-synced by `tours-store`. The calendar page ensures
they are loaded (`loadTours()` if empty) — the map page normally has already
populated them. Friend rows carry an owner distinction (`isFriendTour`) for the
pill styling.

### 6. Nav shell, default view, chrome (per mockups)

The page is a self-contained shell with **no map chrome** (no speed-dial,
profile, or map behind it). Navigation between the two views uses a **persistent
left sidebar on desktop** (`w-64`, items "Planned" + "Seasons") that collapses to
a **bottom nav bar on mobile** — reproducing the mockup, *not* the top
`role="tablist"` tabs used inside the tour-list sheet. A **top app bar** hosts the
back arrow (→ map tour-list) and per-view context: the Planned view shows the
current month with prev/next chevrons (unbounded paging); the Seasons view shows
a static title.

- **Default view: Planned** (not Seasons). It is the epic's center of gravity and
  where #242/#244 build. The active view is a `?view=planned|seasons` query param
  — deep-linkable and the target the detail back button restores. **Not
  persisted** across visits (unlike the localStorage-persisted tour-list tab):
  always open on Planned; only `?view=` overrides.
- **Month is the default calendar view; view mode (month/week) is not
  persisted.**
- **Interactions:** a whole Gantt row and a calendar tour pill open the tour
  (set origin, navigate to `/map`). Empty-day clicks are inert in #240 (they
  become the availability toggle in #242).

## Risks / Trade-offs

- **Hand-rolled week view / paging turns out costly** → escalate to the
  library-fallback rule in decision 4 (Planned view only, no fidelity loss). The
  task-2 checkpoint catches this before both views are built.
- **Map teardown on every calendar round-trip** (route change unmounts the map,
  `mapInstance.remove()`) → accepted for #240 (see decision 1); Swisstopo tiles
  are runtime-cached so rebuild is warm. Perf watch item, not engineered around.
- **Handoff race (map page not mounted when intent is set)** → consume
  `pendingIntent` in `onMounted` after `loadTours()`, mirroring the existing
  `pendingFlyTo` deferral; no reliance on timing.
- **Back-button expectations** → dismiss (close/map-click) must clear the origin
  so the browser back button and the map are consistent; covered by an explicit
  spec scenario and test.
- **Sparse bare page on wide desktop** → handled with layout (max-width, centered
  content), not by adding app chrome.

## Open Questions

- None blocking. Library remains a documented fallback (decision 4); its use is
  gated on the task-2 hand-rolled checkpoint, not assumed.
