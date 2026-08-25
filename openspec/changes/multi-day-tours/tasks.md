## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/264-multi-day-tours`

## 2. Database (local first — never touch prod)

- [x] 2.1 `supabase start`, then `supabase migration new add_tour_end_date` — one new file; NEVER edit an existing migration
- [x] 2.2 In that file: `alter table public.tours add column end_date date;` plus
      `alter table public.tours add constraint tours_end_date_after_start check (end_date is null or planned_date is null or end_date >= planned_date);`
- [x] 2.3 Same file: `drop function public.create_tour_full(<current 20-arg signature>)` and the same for `update_tour_full`, then re-`create function` each with a trailing `p_end_date date default null`. Bodies reproduced verbatim from `20260811093000_add_completed_to_tour_rpcs.sql` with `end_date` threaded into the INSERT column list / UPDATE set-list (design D2). CREATE OR REPLACE is NOT usable — it would leave a second overload
- [x] 2.4 Same file: re-issue `grant execute … to anon, authenticated, service_role` for BOTH new 21-arg signatures — dropping the function dropped its grants
- [x] 2.5 Same file: `create or replace view public.tours_view` reproducing `20260811085649_add_updated_at_for_lww.sql` verbatim with `t.end_date` appended as the new LAST column (positional match — append only, design D3)
- [x] 2.6 Same file: `create or replace view public.friend_tours_view with (security_invoker = true)` reproducing `20260527165812_add_unresolved_partner_count.sql` verbatim with `case when p.is_partner then t.end_date end as end_date` appended as the new LAST column. Gating MUST mirror `planned_date` exactly
- [ ] 2.7 `supabase db reset` — clean run, no errors — **BLOCKED**: no Docker in this environment (`supabase db reset` → `LegacyLocalDbRunningError`). Must be run by hand.
- [ ] 2.8 Verify gating by hand against local DB: as a non-partner friend, `select planned_date, end_date from friend_tours_view` returns null for both; as a partner, both are populated
- [ ] 2.9 Run `supabase/tests/friend_tour_visibility_rls.sql` against the local DB — still passes

## 3. Domain + data layer

- [x] 3.1 `src/features/tours/data/models/tour-schema.ts` — add `end_date: z.string().nullable().default(null)` to `tourRowSchema` and `friendTourRowSchema`; map to `endDate: row.end_date ? new Date(row.end_date) : null` in both transforms; add `endDate: z.coerce.date().nullable().default(null)` to `tourSchema` with a `ponytail:` comment recording that a cache snapshot written before this change hydrates with the field ABSENT, which every consumer treats as single-day (design D11) — do NOT add defensive `?? null` at read sites, and never test `endDate === null`
- [x] 3.2 `src/features/tours/domain/entities/tour.ts` — add `endDate: Date | null` to `TourDraft`
- [x] 3.3 `src/features/tours/data/repositories/tours-repository-impl.ts:33,67` — pass `p_end_date: draft.endDate?.toISOString().split('T')[0] ?? null` in BOTH RPC calls, mirroring the existing `p_planned_date` line
- [x] 3.4 `src/features/tours/presentation/stores/tours-store.ts:225,253` — carry `endDate` through `tourFromDraft` and `tourToDraft`. Nothing else in the store or write-queue changes: `endDate` rides inside `payload.draft`, which is structured-cloned into IndexedDB, and a `Date` survives that
- [x] 3.5 `src/features/tours/domain/tour-notifications.ts:11,37` — widen the date comparison to both endpoints so a changed `endDate` counts as a meaningful edit (design D8). Rename `plannedDateChanged` to reflect that it now compares the span

## 4. Span helper (shared, single source of truth)

- [x] 4.1 `src/features/calendar/domain/calendar-dates.ts` — add `spanDayKeys(start: Date, end: Date | null): string[]`, returning one `dayKey` per calendar day from `start` through `end` inclusive (`[dayKey(start)]` when `end` is null/undefined or not after `start`). Walk LOCAL date parts (`new Date(y, m, d + i)`), never `+86_400_000` ms — a DST transition inside the span must not drop or duplicate a day (design D4)
- [x] 4.2 Same file — export `interface DayEntry { tour: Tour, isFriend: boolean, dayIndex: number, dayCount: number }` (1-based `dayIndex`), and DELETE the duplicate declarations at `planned-calendar.vue:57` and `day-preview.vue:8`, importing this one instead (design D4)
- [x] 4.3 `src/features/calendar/presentation/calendar-tour-demo.ts:19` — the demo chip entry gains `dayIndex: 1, dayCount: 1` and uses the shared type. Demo data stays isolated from the stores, unchanged
- [x] 4.4 `test/features/calendar/domain/calendar-dates.test.ts` — edge cases only: end before start collapses to one key; `undefined` end (stale cache shape, design D11) collapses to one key; span crossing a month boundary; span crossing the CH DST switch (late March / late October) yields exactly one key per calendar day

## 5. Calendar span rendering — **your gap**

- [x] 5.1 `src/features/calendar/presentation/components/planned-calendar.vue:60-77` — implement the span bucketing marked with `// TODO(me):`. `entriesByDay` must push each tour into EVERY key from `spanDayKeys(tour.plannedDate, tour.endDate)`, and each `DayEntry` must carry its `dayIndex` (1-based) and `dayCount` so the pill can label `2/3`. Undated tours stay dropped; friend tours still only enter when `isPartner`. The counter reflects the position in the WHOLE span, not the visible month (design D5)
- [x] 5.2 `planned-calendar.vue:453` (day detail sheet pill) — render the day counter via a new i18n key when `dayCount > 1`, nothing when it is 1
- [x] 5.3 `src/features/calendar/presentation/components/day-preview.vue` — same counter on the **sole-pill** branch (`:22-29`), which is what the desktop grid cell and the mobile day tile render. Leave the count-chip branch (`:30`) alone: it deliberately carries no per-tour surface so a busy cell stays at two short rows (design D5)
- [x] 5.4 `test/features/calendar/presentation/components/planned-calendar.test.ts` — a 3-day tour renders on all three days with `1/3`…`3/3`; a span crossing into the visible month from the previous one still labels by absolute position; a single-day tour renders no counter; a day holding two tours still renders the count chip, not pills

## 6. Filter, form, info sheet

- [x] 6.1 `src/features/tours/presentation/composables/use-tour-filters.ts:145-150` — replace start-date containment with span overlap: `end = tour.endDate ?? tour.plannedDate`; exclude when `from && end < from` or `to && plannedDate > to`. Undated tours stay excluded (design D6)
- [x] 6.2 `src/features/tours/presentation/components/tour-form.vue` — add an `endDate` ref beside `plannedDate` (`:93`), a second `type="date"` input with `:min="plannedDate"` after the planned-date field (`:747`), `endDate` in the submitted draft (`:447`), and a submit-time guard rejecting `end < start` with a localized message. Clearing the planned date clears the end date
- [x] 6.3 `src/features/tours/presentation/components/tour-info-sheet.vue:482` — when `endDate` is set, format with the SAME `Intl.DateTimeFormat` instance's `formatRange(start, end)`; otherwise keep `.format(start)`. No hand-built `"a – b"` string (design D7)
- [x] 6.4 `src/features/map/presentation/pages/map-page.vue:362-381` + the map store's pending-intent type + `calendar-page.vue:114` — carry `originDay` (the `dayKey` of the cell the detail was opened from) through the intent. On back, return to `originDay` **only if it still falls within the tour's live span**; otherwise fall back to `dayKey(plannedDate)` (design D10). Without this, backing out of a tour opened from day 3 lands on day 1
- [x] 6.5 `test/features/tours/presentation/composables/use-tour-filters.test.ts` — overlap edge cases: span straddling `from`, span straddling `to`, span entirely outside, undated tour excluded
- [x] 6.6 `test/features/tours/presentation/components/tour-form.test.ts` — end-before-start blocks submit and emits no save; clearing the planned date clears the end date
- [x] 6.7 `test/features/map/presentation/pages/map-page.test.ts` — back from a detail opened on day 3 of a span returns to day 3; back after the span was edited so it no longer covers day 3 falls back to the start day

## 7. i18n (both locales, same commit)

- [x] 7.1 `src/locales/en.json` — under `tours.form`: `endDateLabel`, `endDateBeforeStartError`. Under the calendar namespace: a parameterized day-counter key (`{day}` / `{total}`). Check for an existing reusable key before adding any of them
- [x] 7.2 `src/locales/de-CH.json` — mirror every key from 7.1. Never leave a locale short
- [x] 7.3 The counter key must be readable out of context for a screen reader — the visible pill text may be `2/3`, but give the pill an `aria-label` / `title` from a spelled-out key ("Day 2 of 3"), not the bare fraction
- [x] 7.4 Relabel the existing `plannedDateLabel` copy if "Planned date" now reads ambiguously next to an end date (e.g. start-of-tour wording) — same key, both locales

## 8. Verification

- [x] 8.1 `npm run test` — 1305/1305 pass
- [x] 8.2 `npm run type-check` — clean
- [x] 8.3 `npx eslint . --fix` — zero warnings
- [ ] 8.4 Manual against local Supabase: create a 3-day tour → it appears on 3 calendar days with counters; edit it to single-day → it collapses to one day; filter by a range overlapping only its middle day → it matches; open it as a non-partner friend → no dates shown
- [ ] 8.5 Offline check: go offline, edit a tour's end date, go back online → the replayed write persists the new end date (no `p_end_date` regression in the outbox path)

## 9. Finalize

- [ ] 9.1 Prompt user to commit (do NOT commit) with message:
      `feat(tours): support multi-day tours via nullable end_date (#264)`
      and a body noting the RPC signature change (drop/recreate, trailing defaulted arg) and the filter switch to overlap semantics
- [ ] 9.2 Prompt user to push the branch and open a PR to `main`
- [ ] 9.3 Prompt user to run `supabase db push` as a deploy step — **before** the frontend release reaches prod (design D2 ordering). Do NOT run it unprompted
- [ ] 9.4 Prompt user to archive this change with the `openspec-archive` skill
