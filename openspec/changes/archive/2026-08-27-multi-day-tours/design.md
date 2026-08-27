## Context

The single planned date is threaded through five layers:

| layer | site |
|---|---|
| table | `tours.planned_date date` — `20260101000000_initial_schema.sql:424` |
| RPCs | `create_tour_full` / `update_tour_full`, `p_planned_date date default null` — `20260811093000_add_completed_to_tour_rpcs.sql:28,101` |
| views | `tours_view` (`20260811085649:59`), `friend_tours_view` gated `case when p.is_partner then t.planned_date end` (`20260527165812:63`) |
| schemas | `tourRowSchema`, `tourSchema`, `friendTourRowSchema` — `tour-schema.ts:22,80,120` |
| consumers | `tour-form.vue:93,447,748`, `tour-info-sheet.vue:482`, `use-tour-filters.ts:145-150`, `planned-calendar.vue:64`, `tour-notifications.ts:11,37`, `map-page.vue:366`, `tours-store.ts:225,253` |

Two facts shape every decision below:

1. **Filtering is client-side.** `use-tour-filters.ts:161` filters the already-loaded
   `Tour[]` in JS. There is not one SQL date predicate in the app.
2. **`tour-list-row.vue` renders no date at all** — the `tour-list-view` spec text claiming
   it does is stale. So the list rows need no work here.

## Goals / Non-Goals

**Goals**

- Record a tour that spans N days, and see it on every one of those N days.
- Zero behaviour change for existing single-day tours, at every layer.
- Keep in-flight offline-outbox entries replayable across the deploy.
- Preserve the Layer-2 privacy contract: a non-partner friend learns nothing new.

**Non-Goals**

- Per-day waypoints / stages (D1).
- Server-side date filtering, overlap indexes, exclusion constraints.
- Rendering the span as a continuous bar spanning calendar cells (D5).
- Fixing the pre-existing UTC-midnight parse quirk in `plannedDate` (D4).

## Decisions

### D1 — Nullable `end_date`, not `daterange`, not `duration_days`

```sql
alter table public.tours add column end_date date;
alter table public.tours add constraint tours_end_date_after_start
  check (end_date is null or planned_date is null or end_date >= planned_date);
```

`planned_date` keeps meaning "start". `end_date is null` ⇒ single-day.

Rejected — **`daterange`**: its payoff is the `&&` overlap operator and exclusion
constraints, both of which are SQL-side; this app filters in JS (fact 1), so the payoff is
zero. Its costs are real: PostgREST returns `"[2026-08-25,2026-08-28)"`, needing parse and
serialize in both zod transforms plus the IndexedDB cache and outbox payloads; the
half-open convention makes the stored end **exclusive**, so every display, day counter and
calendar bucket carries a `−1 day`; and it breaks all ~15 existing `planned_date` reads,
including the three gated friend views.

Rejected — **`duration_days`**: every consumer computes the end itself, and the CHECK
constraint it saves is one line.

The user's motivation for `daterange` was a possible future "waypoints, each with its own
date". That is orthogonal: waypoints are a child table
(`tour_waypoint(tour_id, seq, lng, lat, day_date)`, precedent `tour_link_member` in
`20260528062747_tour_links.sql:13`), and if it ever lands the tour's span becomes derived
from `min/max(day_date)` — making *any* span column a denormalized cache. Nothing about
that future prefers a range type today.

### D2 — RPCs: drop + recreate with a trailing defaulted arg

`CREATE OR REPLACE FUNCTION` cannot change a signature; adding `p_end_date` would leave a
second overload and make PostgREST's named-argument resolution ambiguous. Follow the exact
precedent of `20260811093000`: `drop function public.<fn>(<current 20-arg signature>)`, then
`create function` with `p_end_date date default null` appended, then re-issue the Data-API
grants **for the new signatures**. Bodies reproduced verbatim from `20260811093000` with
only `end_date` threaded into the column list.

`default null` is what makes the deploy safe in both directions: an outbox entry queued by
the old client omits the argument and replays as a single-day tour, and the old deployed
frontend keeps working against the new DB. Ordering: **migration first, frontend second.**

### D3 — Views append only, gating mirrors `planned_date`

`CREATE OR REPLACE VIEW` matches columns positionally and may only append, so both views are
reproduced verbatim from their latest definitions with `end_date` as the new **last**
column (`tours_view` after `updated_at`; `friend_tours_view` after its trailing columns).
The zod schemas key by name, so column position is irrelevant client-side.

`friend_tours_view` gets `case when p.is_partner then t.end_date end as end_date`. Anything
else would let a non-partner infer the trip length of a tour whose start date is withheld —
a leak the existing Layer-2 contract exists to prevent.

### D4 — One day-key convention: `spanDayKeys(start, end)`

`plannedDate` originates as `new Date('2026-08-25')` (`tour-form.vue:447`) = **UTC**
midnight, while `dayKey()` (`calendar-dates.ts`) reads **local** components. In CH (UTC+1/+2)
these agree; at negative UTC offsets they do not. That quirk predates this change and is
left alone — but it must not be compounded, so span expansion gets exactly one helper in
`calendar-dates.ts`:

```ts
export function spanDayKeys(start: Date, end: Date | null): string[]
```

It walks by **local calendar date parts** (`new Date(y, m, d + i)`), never by adding
86 400 000 ms, so a DST transition inside the span cannot drop or duplicate a day. Every
bucketing and counting site consumes this one function — the calendar never derives day
keys itself.

`DayEntry` moves into the same file, exported, gaining required `dayIndex` (1-based) and
`dayCount`. It is declared three times today — `planned-calendar.vue:57`, `day-preview.vue:8`,
and structurally in `calendar-tour-demo.ts:19` — so adding fields otherwise means adding them
three times. It sits beside `spanDayKeys` because that helper is what mints the indices.
Required, not optional: the invariant "an entry knows its position in its span" is the whole
point of the change, and optional fields would scatter `?? 1` across every read site. The
onboarding demo chip becomes an honest `dayIndex: 1, dayCount: 1`.

### D5 — Chip on every day, with a day counter

`entriesByDay` (`planned-calendar.vue:60-77`) pushes each tour into `spanDayKeys(...)`
instead of a single key, carrying `dayIndex` / `dayCount` in the entry. The pill shows
`n/N` when `dayCount > 1`, nothing when it is 1.

Pills live in **two** components, and both get the counter:

| site | component | shape |
|---|---|---|
| desktop grid cell **and** mobile day tile | `day-preview.vue` | one pill if the day has exactly one tour, else a generic "N tours" count chip |
| day detail sheet | `planned-calendar.vue:453` | one full-width pill per tour |

The counter goes on the detail-sheet pill and on `day-preview`'s **sole-pill** branch —
without the latter the grid shows one tour on N cells with nothing marking it as one tour,
which is the legibility problem the counter exists to solve. The count-chip branch (a day
with more than one tour) is unchanged: it already reads "3 tours" and deliberately carries
no per-tour surface, so a cell never exceeds two short rows.

Rejected — start-day-only: a tour running today would be invisible on today's cell, which is
the actual complaint in the issue. Rejected — a bar spanning cells: needs row-span layout in
the desktop grid and has no meaning in the mobile day-tile list, which is per-day by
construction (`calendar-view` spec: empty days are kept deliberately).

### D6 — Filter: span overlap

```ts
const start = tour.plannedDate
const end = tour.endDate ?? start
if (!start) return false          // unchanged: undated tours stay excluded
if (from && end < from) return false
if (to && start > to) return false
```

Standard interval intersection. Single-day tours (`endDate === null`) collapse to exactly
today's behaviour, so no existing filter test changes meaning.

### D7 — Display via `Intl.DateTimeFormat.formatRange`

`tour-info-sheet.vue:482` already builds an `Intl.DateTimeFormat`; the same instance's
`formatRange(start, end)` yields "25.–27. August 2026" in `de-CH` and "August 25 – 27, 2026"
in `en`, collapsing shared parts per locale rules. No hand-built `"$start – $end"` string,
no new i18n key for the separator. `end == null` keeps calling `.format(start)`.

### D8 — Notifications: rename to span comparison

`plannedDateChanged` (`tour-notifications.ts:11`) becomes a comparison over both endpoints
(same null-safe `getTime()` test applied to `endDate`). The `shared-tour-notifications`
spec's "planned date" member of the partner-facing set becomes "planned date span". A tour
extended from one day to three is exactly the kind of change a partner must hear about.

### D9 — End-date input is always visible, and validation is client-side plus the CHECK

The end input sits directly under the planned date, always rendered, labelled optional — no
"multi-day tour" toggle. A toggle would buy a tidier form for the single-day majority at the
cost of a state ref, a reveal decision, an untoggle-clears rule, and a pre-checked state when
editing an existing span: four things that can be wrong to hide one empty input. Two adjacent
date inputs read as a range with no interaction needed to discover the feature.

The date input for the end gets `:min="plannedDate"` (native constraint, free), plus an
explicit submit-time check that sets an error message — `min` alone is bypassable by typing.
The DB CHECK is the backstop. No max span: an expedition is a legitimate two-week tour, and
a cap is a limit invented for no reported reason.

### D10 — Return day: carry the origin day, validated against the live span

`handleTourInfoBack` (`map-page.vue:362-381`) derives the calendar day to return to from the
tour's **live** `plannedDate`. With spans that is a regression this change would introduce:
open a 3-day tour from its 26 Aug cell, tap back, and the calendar re-opens 25 Aug — a day
the user was never on. Impossible today (one tour = one day), so the feature creates it.

The plumbing already exists: the pending intent carries `origin` (`calendar-page.vue:114` →
`map-page.vue:439`). It gains `originDay` alongside. On back:

- use `originDay` **if it still falls within the tour's live span**;
- otherwise fall back to `dayKey(plannedDate)`.

The validation is what preserves the intent of the comment at `:363` — the date may have been
edited inside the detail sheet, and an edit that moves the span out from under the stored day
must not return the user to a day the tour no longer covers.

### D11 — Cached tour snapshots written before this deploy are tolerated as-is

`entity-cache.ts` structured-clones values with no zod parse on read, so a `tours:<uid>`
snapshot written before this change hydrates with `endDate` **absent**, not null, while the
type says `Date | null`.

Nothing is done about it, and no defensive `?? null` is added: `spanDayKeys` treats any falsy
end as single-day, the filter uses `tour.endDate ?? tour.plannedDate`, the info sheet branches
on truthiness, and the notification diff already normalizes through
`(a?.getTime() ?? null)`. No consumer tests `=== null` or key presence, so `undefined` and
`null` are behaviourally identical here, and `cachedLoad` is hydrate-then-refetch so the stale
shape survives one round-trip online. A `ponytail:` comment on the schema field records
`undefined` as an accepted transient shape.

Rejected — versioning the cache key (`tours:v2:<uid>`): buys type-honesty for one refetch
cycle at the price of a permanent versioning convention that exists for one collection,
orphaned IndexedDB entries, and a bump-or-don't decision for whoever next changes the `Tour`
shape. Rejected — parsing cached rows through `tourSchema` on hydrate: parses the whole
collection on every hydrate and silently drops rows that fail validation, turning a cosmetic
shape gap into a data-loss path.

## Risks / Trade-offs

- **Long spans clutter the calendar.** A 14-day tour occupies 14 cells. Accepted: that is
  the truthful rendering, and the day counter makes it legible as one tour.
- **Two writes of the same tour across the deploy boundary.** An old client updating a tour
  that already has an `end_date` sends no `p_end_date`, and `update_tour_full` sets
  `end_date = p_end_date` — i.e. **null**, silently clearing the span. This is the same
  full-row-overwrite semantics every other field already has (an old client would equally
  clear `p_completed`), and it resolves as soon as the client updates. Called out rather
  than engineered around: a `coalesce` would make clearing the end date impossible.
- **The day-key helper is date-shaped, deliberately.** `spanDayKeys(start, end)` fills a
  contiguous range. If tours later gain per-day waypoints whose dates may be non-contiguous
  (a rest day, two separate weekends), the signature cannot express that day set and its
  consumers — the calendar bucketing and the day counter — are reshaped along with it.
  Accepted knowingly: a tour-shaped `tourDayKeys(tour)` would localize that future swap, at
  the cost of a less direct unit test today. Nothing else in this change depends on the
  choice.
- **`tours_view` / `friend_tours_view` are reproduced verbatim.** A transcription slip
  silently changes a view. Mitigated by `supabase db reset` plus the existing RLS test
  `supabase/tests/friend_tour_visibility_rls.sql`.

## Migration Plan

1. New migration via `supabase migration new add_tour_end_date` — column, CHECK, RPC
   drop/recreate + grants, both views.
2. `supabase db reset`, run `npm run test`, verify locally against the app.
3. Frontend change lands in the same PR; `supabase db push` is a prompted deploy step
   executed **before** the frontend release reaches prod.

Rollback: `end_date` is additive and nullable — reverting the frontend alone leaves the
column unread and every tour behaving as it did before.

## Open Questions

_(none — data model, calendar rendering, filter semantics and RPC rollout were all settled
with the user before this proposal was written.)_
