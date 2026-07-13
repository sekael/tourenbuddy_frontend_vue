## Context

The planned calendar (`src/features/calendar/`) renders own + partner tours per
day, with a desktop month grid and a mobile day-list (`planned-calendar.vue`),
driven by `buildMonthGrid`/`dayKey` (`domain/calendar-dates.ts`) and paged by
month from `calendar-page.vue`. The feature has no `data/` layer — it reads
directly from `tours-store`.

This change adds per-day *own* availability: users mark the days they can tour and
see them as a light-green overlay. Reading friends' availability, realtime sync,
and friend contact chips are GitHub #244 — this change deliberately stops short of
them but shapes the schema and RLS so #244 is purely additive. It stands up the
calendar feature's `data/` + `domain/repositories` + store layers for the first
time.

## Goals / Non-Goals

**Goals:**
- Own-availability editing: enter mode, tap/drag to toggle, diff-save, disclaimer.
- Render own availability as a light-green overlay in view and edit mode.
- A data model + RLS that make #244 (friend read, realtime, intersection) additive
  — new policies/triggers only, no schema change.

**Non-Goals (all #244):**
- Reading or rendering friends' availability; contact chips / "and more" list /
  messaging-calling actions.
- Realtime synchronization of availability (own or friends').
- Time-of-day granularity (whole-day only); past-date availability.
- Seasons view changes.

## Decisions

### D1: One row per available day, composite PK `(user_id, date)`
`user_availability(user_id uuid references auth.users on delete cascade, date
date, primary key (user_id, date))`.
- **Why**: toggling a day is a single insert/delete; the composite PK is the
  natural key, gives idempotent upsert and blocks duplicates for free. It is also
  the shape #244 needs: friend intersection is `select date from user_availability
  where user_id = any(<friend ids>) group by date` — no schema change, just a
  friend-read RLS policy added later.
- **Alternatives**: (a) date ranges (`daterange` + GiST) — more compact but painful
  to toggle single days and to intersect; rejected as premature. (b) surrogate `id`
  PK + unique `(user_id, date)` — extra column, no benefit; the natural key is
  already unique and stable. YAGNI.
- `date` is a SQL `date` (no timezone). Client keys days with the existing local
  `dayKey` (`YYYY-MM-DD`) — avoids the `toISOString` UTC-shift bug already
  documented in `calendar-dates.ts`.

### D2: RLS — owner-only now, structured so friend-read is additive
Owner policies only in this change: SELECT/INSERT/DELETE where
`user_id = auth.uid()`. Grants: `grant all on table public.user_availability to
anon, authenticated, service_role` (Data API exposure; RLS still governs rows).
- **Forward-compat for #244**: the friend-read path is an *additive* policy that
  ORs onto the owner SELECT policy, mirroring `tours_select_friend`
  (`exists (select 1 from friendships f where (f.request_user_id = auth.uid() and
  f.response_user_id = user_availability.user_id) or (…reversed…))`). Adding it is
  a new migration with a new policy — no change to the table or the owner
  policies. No SECURITY DEFINER view is needed even then: an availability row has
  no per-viewer-gated columns to null out (unlike `friend_tours_view`), so a plain
  additive SELECT policy suffices.

### D3: Load-full-future-set + diff save via an atomic RPC
On entering edit mode, reuse the already-loaded own-availability set (see D8) as an
editable Set of `dayKey`s (the baseline). Toggling mutates a working Set. On Save,
diff working vs baseline: `added = working \ baseline`; `removed = baseline \
working`. Both are applied by a single SECURITY INVOKER RPC
`apply_availability_diff(added date[], removed date[])` that inserts and deletes in
one transaction, so a save is all-or-nothing. Unchanged days are never rewritten;
inserts use `on conflict do nothing` inside the function for idempotency against a
racing echo.
- **Why RPC over two client calls**: two separate `insert` + `delete` calls are not
  transactional — a partial failure leaves the DB half-applied. The RPC makes the
  diff atomic. SECURITY INVOKER keeps owner-only RLS in force (the function cannot
  touch another user's rows).
- **Why**: satisfies "edit all availabilities ever" (future-bounded) with minimal
  writes; the diff is two set operations. Future-only keeps the baseline bounded so
  a full load is cheap.
- **Concurrency**: `ponytail:` last-write-wins per day is fine — availability is
  single-user-owned and low-churn; no locking.

### D4: Rendering — own overlay as a background layer
Own availability renders as a light-green background layer on the day cell
(desktop) / day row (mobile), under the existing tour pills — never occupying the
pill rows, so tours and availability coexist. Same overlay in view and edit mode;
in edit mode it reflects the in-progress working Set live. Use theme tokens +
`color-mix` so it coexists with the existing `--today` tint and `--muted` dim and
reads in both light and dark themes.
- **Why**: one visual language, no new cell layout; keeps the density manageable
  (#244 will add friend chips into the pill area — the overlay staying in the
  background leaves that room free).

### D5: Entry via an extended FAB, edit controls as a bottom bar
The **Edit availability** entry is an **extended** floating action button in the
bottom-right corner — a pill showing an edit icon (e.g. `edit_calendar`) **plus the
localized "Edit availability" text**. `round-action-button.vue` is icon-only and
cannot show text, so this needs a small new/variant extended-FAB component (or an
`extended` prop on `round-action-button`); reuse its shadow/token styling. On
entering edit mode the FAB is hidden and a bottom action bar with Save/Cancel is
shown (matching the mockup's bottom "Cancel / Save Changes").
- **Positioning**: the FAB is fixed to the bottom-right of the calendar canvas and
  MUST clear the mobile bottom-nav bar (`64px + --safe-bottom`, since `calendar-page`
  is `column-reverse`): `bottom: calc(64px + var(--safe-bottom) + var(--spacing-md))`
  on mobile, `bottom: var(--spacing-xxl)` on desktop (nav is a left sidebar there).
- **Why**: the top bar on the Planned view is already dense (back, month nav,
  Today); a FAB is the app's established primary-action affordance, thumb-reachable
  on mobile, and leaves the top bar untouched. Extended (with text) over icon-only
  for discoverability — "Edit availability" is not a self-evident glyph.
- **Alternative**: top-bar button — rejected, crowds an already-tight bar and is
  out of thumb reach on mobile.

### D6: Selection — desktop drag, mobile tap
**Desktop grid:** pointer events. `pointerdown` on a selectable day starts a drag
and records the intended direction (mark vs clear) from that first day;
`pointerenter` hit-testing applies the same direction to each consecutive day
entered until `pointerup`. Past days are skipped.

**Mobile list:** single tap only (`@click` toggle), no swipe-select. Swipe would
require `touch-action: none` on day rows, which kills native list scrolling — the
day list must stay scrollable in edit mode. `click` also naturally distinguishes
a tap from a scroll (the browser suppresses `click` when the touch becomes a
scroll), so a scroll gesture never toggles a day.
- **Why**: on a phone-first app, keeping the list scrollable in edit mode beats
  swipe-select; the issue's "swipe across to mark them all" is honored on the
  desktop grid where there is no scroll conflict.

### D7: One canonical timezone for availability dates
An availability `date` is a plain SQL `date` with no time. To keep "today" (the
past/future cutoff) and per-day identity meaning the same calendar day on client and
server, all date reasoning is normalized to **one canonical timezone
(Europe/Zurich**, the app's domain TZ). The **client** derives the cutoff and all
day-keys in that TZ and passes the cutoff to the query; the **DB never computes
"now"** (no `current_date`/`now()` in the availability query or RPC — the RPC only
applies the day arrays it is given).
- **Why**: `current_date` is UTC on the server; the existing `dayKey` is *device*
  local. Near midnight those disagree by a day, the exact UTC-shift class of bug
  `calendar-dates.ts` already warns about. A single canonical TZ removes the
  ambiguity.
- **Note / tension to resolve in implementation**: existing `dayKey` uses device
  local time. Either (a) accept device-local as the shared convention app-wide (fine
  while users are in CH), or (b) make the availability cutoff explicitly
  Europe/Zurich via `Intl` and keep it consistent with how days are keyed. Pick one
  and apply it to both the cutoff and cell selectability so they never disagree.

### D8: Data lifecycle — load on Planned mount; navigate-away discards
The availability store loads the user's own future availability when the Planned
view mounts (mirroring how `tours-store` is populated on calendar mount), so the
light-green overlay renders in **view mode** without opening the editor. Entering
edit mode reuses that already-loaded set as its baseline — no second fetch. Leaving
edit mode by any route (Cancel, switching to Seasons via nav, back button) discards
the working set with **Cancel semantics — no confirmation dialog**.
- **Why load-on-mount**: the overlay is a view-mode affordance, not an edit-only one;
  loading only on edit would leave a cold page load with a blank overlay.
- **Why silent discard**: re-toggling days is cheap and reversible; a dirty-state
  guard + confirm modal is disproportionate. `ponytail:` add a confirm only if
  accidental loss is reported.

### Deferred (#244), noted so this change doesn't paint into a corner
- **Friend name resolution**: when #244 renders friend chips, reuse
  `get_user_names_by_ids` (profile first/last name) — the same source
  `friend_tours_view` uses for partner names. Decided now for consistency; not
  built here.
- **Realtime**: #244 will add own `postgres_changes` (`user_id=eq.<uid>`) + a
  friend broadcast trigger + realtime-messages RLS policy mirroring
  `friend_tours_broadcast_trigger`. This change does no realtime and does not add
  the table to the `supabase_realtime` publication — so no stack-restart step
  here. #244 adds all of that additively.

## Risks / Trade-offs

- **Cell visual density later** → keeping the own overlay in the background (not the
  pill rows) reserves space for #244's friend chips; validate on ~375px now so #244
  inherits a clean layout.
- **Overlay legibility in dark mode** → theme tokens + `color-mix`; verify both
  themes.
- **Baseline load assumes future-bounded set** → future-only editing keeps it
  small; if a user somehow accrues a huge future set, the full load is still a
  single indexed range scan on the PK.

## Migration Plan

1. `supabase migration new create_user_availability` — table + grants + owner-only
   RLS (SELECT/INSERT/DELETE on `user_id = auth.uid()`).
2. Apply locally (`supabase db reset`); verify owner CRUD and that a second user
   cannot read/write the first user's rows. No publication/trigger changes, so no
   stack restart needed.
3. `supabase db push` to prod is a prompted deploy step, after review — never run
   unprompted. No Worker changes.
4. **Rollback**: forward-only; a follow-up migration can drop the table/policies.
   Feature is additive, no data migration.

## Open Questions

- None blocking.
