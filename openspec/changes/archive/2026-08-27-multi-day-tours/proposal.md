## Why

Issue #264 (user feedback): a tour can only carry a single planned date. Hut-to-hut
tours, ski traverses and multi-day alpine routes — the core use case of this app — are
therefore either recorded on their start day only (and vanish from the calendar on day 2,
the day the user is actually on the mountain) or split into N fake tours pinned at N
locations.

Today `tours.planned_date` is a single `date` column (`20260101000000_initial_schema.sql:424`),
surfaced as `Tour.plannedDate: Date | null` and bucketed onto exactly one calendar day
(`planned-calendar.vue:64-66`).

## What Changes

- **`tours.end_date date` (nullable)** — new column, new migration. `planned_date` remains
  the **start**; `end_date is null` means a single-day tour, so every existing read keeps
  working untouched. A CHECK constraint enforces `end_date >= planned_date`.
- **Both tour write RPCs gain a trailing `p_end_date date default null`.** Per the
  precedent in `20260811093000_add_completed_to_tour_rpcs.sql`, adding an argument changes
  the signature, so each function is DROPped by its current 20-arg signature and re-CREATEd
  with 21 args; the default keeps offline-outbox entries queued before the deploy replaying
  correctly (they simply omit the argument).
- **Views expose it, gated identically to `planned_date`.** `tours_view` appends `end_date`;
  `friend_tours_view` appends `case when p.is_partner then t.end_date end`. A non-partner
  friend must not learn how long a tour lasts any more than when it starts.
- **Calendar plots the whole span.** A tour appears on every day from start to end, with a
  day counter (`1/3`, `2/3`, `3/3`) on the pill, so a running tour is visible on today's
  cell rather than only on its start day.
- **Date filter switches to overlap semantics** — a tour matches when its span intersects
  `[from, to]`, not when its start date does. "What's happening next week" must find a tour
  that started the Friday before.
- **Form gains an end-date input** with `end >= start` validation; the info sheet renders
  the span via `Intl.DateTimeFormat.formatRange`, which produces the locale-correct compact
  form ("25.–27. August 2026" / "August 25 – 27, 2026") with no hand-rolled formatting.
- **Notifications**: the meaningful-edit set already contains "planned date"; it now fires
  when **either** endpoint moves, so a partner learns the tour got a day longer.

- **Back-navigation keeps the day you came from.** Opening a tour from day 2 of a span and
  tapping back currently returns to day 1 — a regression this feature would introduce. The
  calendar's pending intent gains the origin day, validated against the tour's live span.
- **Declared scope additions:** (a) `DayEntry` is declared three times today
  (`planned-calendar.vue`, `day-preview.vue`, `calendar-tour-demo.ts`) and becomes one
  exported type beside `spanDayKeys`; (b) the `tour-list-view` spec's claim that rows show a
  planned date is corrected — `tour-list-row.vue` has rendered none since the
  tour-identity-display change. (b) is documentation-only; no list code changes.

Explicitly out of scope: per-day waypoints or a `tour_waypoint` child table (a separate,
larger change — see design D1); per-day notes; a maximum span cap; any SQL-side date
filtering (the app filters the loaded array client-side); showing spans on the map.

## Capabilities

### New Capabilities

_(none — this extends the existing tour model and its views)_

### Modified Capabilities

- `tour-extended-model`: the tour schema and `TourDraft` gain an optional `endDate`, with
  `null` defined as "single-day tour" and an ordering invariant against `plannedDate`.
- `tour-form-extended`: the form gains an end-date input and the ordering validation.
- `tour-info-extended`: the planned date renders as a date **range** when a span is set.
- `tour-list-view`: the planned-date range filter changes from start-date containment to
  span overlap; the stale row-content requirement is corrected to match the component.
- `calendar-view`: a tour is plotted on every day of its span, each pill carrying a day
  counter, and detail back-navigation returns to the day it was opened from.
- `friend-tour-visibility`: `end_date` joins `planned_date` / `gpx_filepath` / partner names
  in the Layer-2 non-partner gated set.
- `shared-tour-notifications`: the partner-facing field set covers both span endpoints.

## Impact

- **DB**: one new migration — column + CHECK, drop/recreate of `create_tour_full` and
  `update_tour_full` with grants re-issued for the new signatures, `CREATE OR REPLACE` of
  `tours_view` and `friend_tours_view` (append-only, bodies reproduced verbatim from their
  latest definitions).
- **Deploy ordering**: migration must land before the frontend build that sends
  `p_end_date`. Old client → new DB is safe (argument defaults to null).
- **Code**: `tour-schema.ts` (3 schemas), `tour.ts` (`TourDraft`), `tours-repository-impl.ts`
  (both RPC calls), `tours-store.ts` (`tourFromDraft` / `tourToDraft`), `tour-form.vue`,
  `tour-info-sheet.vue`, `use-tour-filters.ts`, `planned-calendar.vue`,
  `calendar-dates.ts` (one span helper), `tour-notifications.ts`.
- **Offline**: no write-queue schema change — `endDate` rides inside the existing
  `payload.draft`, which is structured-cloned into IndexedDB (a `Date` survives).
- **i18n**: new keys in `en.json` and `de-CH.json` for the end-date label, the validation
  error, and the calendar day counter.
- **Worker**: none. No `wrangler deploy`.
- **Risk**: low. `end_date is null` reproduces today's behaviour exactly, so every existing
  tour and every code path that ignores the new column is unaffected.
