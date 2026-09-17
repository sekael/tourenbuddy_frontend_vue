## Context

### What exists today

`user_availability` is `(user_id, date)` — one row per available day, nothing else
(`20260710062534_create_user_availability.sql`). Every write goes through one atomic RPC,
`apply_availability_diff(added date[], removed date[])`, `SECURITY INVOKER`, so owner-only RLS
gates it and `auth.uid()` resolves to the caller. The store
(`availability-store.ts`) computes the diff against a baseline captured on `enterEdit`, routes
it through the offline `mutate()` seam, and registers an `availability` replay handler that
re-derives the diff from a fresh `listOwnFrom()` at drain time.

Two readers exist: `listOwnFrom` (explicitly `.eq('user_id', selfId)`, because #244's friend
SELECT policy would otherwise fold friends into the owner's green overlay) and `listFriendsFrom`
(`.neq('user_id', selfId)`, RLS scopes the rest).

The Worker (`services/email-hook`) already carries `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` for notification fanout and has its own `vitest.config.ts` and
`test/` directory. It has no cron trigger yet.

### Why a row-delete cannot express "not available"

The table stores *available* days; "unavailable" is the absence of a row. That is sufficient
while a human is the only writer. With a second writer it is not: a user who clears a
calendar-derived day deletes the row, and the next sync — six hours later, from a calendar that
still shows that day as free — inserts it back. The user's correction silently evaporates. The
absence of a row is ambiguous between "never considered" and "deliberately rejected", and the
sync needs to tell them apart. That is the core data-model problem this change solves.

### Why the obvious inbound options were rejected

Recorded in `proposal.md`. The short version: the email-invite route needs inbound mail parsing
and cancellation semantics for a strictly worse result, and OAuth buys near-realtime freshness
against a requirement of "hours is fine" at the price of provider-by-provider integration plus
a verification review.

## Goals / Non-Goals

**Goals**

- Connecting a calendar removes the manual availability chore for the common case.
- A manual correction is permanent and never undone by a later sync.
- A broken or rotated feed can never widen availability.
- Event text never reaches Tourenbuddy storage.
- The user's planned and linked tours appear in their own calendar app.

**Non-Goals**

- OAuth providers, write-back of availability, intra-day granularity, holiday calendars,
  realtime push channels, syncing anyone else's calendar.
- A separate availability-provenance UI. A calendar-derived day and a manual day render
  identically.

## Decisions

### D1 — Secret ICS pull, not OAuth, not email invites

One transport covers Google, Apple iCloud, Outlook and Nextcloud, because all four expose a
private "secret address in iCal format" URL. No consent screen, no verification review, no
refresh tokens, no per-provider code path. The cost is freshness — Google republishes its
secret ICS lazily, on the order of hours — which is exactly the tolerance agreed for this
change. Options table and rejections: `proposal.md`.

### D2 — Seed, not source of truth: `source` + `available` on one table

```sql
alter table public.user_availability
  add column available boolean not null default true,
  add column source text not null default 'manual'
    check (source in ('manual', 'calendar'));
```

Precedence, enforced in SQL rather than in the Worker:

| row state | meaning | sync may touch it |
|---|---|---|
| `available = true,  source = 'calendar'` | derived from a feed | yes — rewritten every sync |
| `available = true,  source = 'manual'`   | user marked it available | **never** |
| `available = false, source = 'manual'`   | tombstone: user cleared it | **never** |

Readers filter `available = true`, so the tombstone is invisible to the overlay, the friend
query, the offline cache and the replay handler. One column on the existing table beats a
second `user_availability_pins` table: a pin table would duplicate the effective set across two
places and force every reader to join.

`apply_availability_diff` is replaced (`create or replace` in a **new** migration — migration
history is immutable) with a body that writes `source = 'manual'` on insert and, on removal:

```sql
-- Tombstone only if the user actually has a feed that could re-add the day.
-- Otherwise a plain delete, so the 99% who never connect a calendar keep a clean table.
```

The signature is unchanged, so `availability-repository-impl.ts`, the `mutate()` intent and the
replay handler need no change beyond the reader filter.

**Rejected:** having the Worker read manual rows and diff in TypeScript. It turns a
constraint into a convention, and a Worker bug would then be able to delete manual rows.

### D3 — Busy rule: largest contiguous free block

For each day in the horizon, in `Europe/Zurich`:

1. Collect timed events overlapping the local day, clip each to `[core_start, core_end]`.
2. Merge overlapping busy intervals.
3. Take the largest gap between them (including the leading gap from `core_start` and the
   trailing gap to `core_end`).
4. `available := largestFreeGap >= min_free_minutes`.

Against a 06:00–18:00 window with a 6 h minimum:

| day | busy | largest free gap | result |
|---|---|---|---|
| dentist 08:00–09:00 | 1 h | 09:00–18:00 = 9 h | available |
| calls at 09:00 and 16:00 | 2 × 30 min | 09:30–16:00 = 6.5 h | available |
| workday 09:00–17:00 | 8 h | 06:00–09:00 = 3 h | busy |
| lunch meeting 13:00–14:00 | 1 h | 06:00–13:00 = 7 h | available |

Rejected alternatives: *any overlap → busy* marks the dentist day busy and deletes the
feature; *total busy minutes ≥ N* marks the scattered-calls day available at 60 busy minutes,
missing the fragmented working day that is the single most common case; *first-to-last span ≥ N*
is a proxy that scores a genuinely free afternoon as busy. Free-block is the only rule that
states the actual requirement: a tour needs one large uninterrupted stretch.

`core_start` / `core_end` / `min_free_minutes` live per user in `user_calendar_settings`
(not per feed — the union in D5 makes a per-feed window meaningless). Alpine starts are real:
04:00–12:00 is a valid window. The check constraint

```sql
check (min_free_minutes <= (extract(epoch from (core_end - core_start)) / 60))
```

rejects an unsatisfiable configuration at write time. Without it, `min_free = 480` in an
8 h window silently marks every single day busy and the user has no way to see why.

### D4 — All-day events ignored; 60-day horizon; Europe/Zurich

**All-day events are skipped entirely.** They carry no time information to intersect with the
core window, and their semantics are contradictory: "Birthday Anna" and "1. August" are not
busy, and "Vacation" is the best tour week of the year. A multi-day-span heuristic was
considered and rejected as an unexplainable rule for a marginal gain.

**Horizon `[today, today + 60d]`.** Beyond it the sync writes nothing, so untouched days stay
unmarked. An empty calendar in March is not a claim about March; friends act on these overlays.
The horizon rolls, so each run recomputes the whole window.

**All evaluation in `Europe/Zurich`.** ICS `DTSTART` arrives as UTC (`Z`), floating (no zone),
or `TZID`-qualified. Normalize via `ical.js`, then clip events to local day boundaries — a
Friday 18:00 → Sunday 20:00 event contributes busy time to three days, entirely outside the
core window on two of them. Recurrence is expanded with `ical.js`'s `RecurExpansion`; hand-rolled
RRULE (`BYSETPOS`, `EXDATE`, DST-crossing `UNTIL`) is a well-known trap and the library is
already the de-facto reference implementation.

### D5 — Multi-feed union, and fail closed

Feeds live in `user_calendar_feeds`, capped at 5 per user by a trigger (cron cost is linear in
feeds). Merge is a **union of busy intervals** before the D3 computation — not a union of
resulting available days, which would let a work meeting and a private appointment each leave a
6 h gap on their own while jointly leaving none.

**If any feed fails, nothing is written for that user.** A 404, a timeout, a 403 from a rotated
secret URL or an unparseable body all yield zero busy intervals, and zero busy intervals means
*every day in the horizon is available* — a silent, confident, wrong widening that friends then
plan around. The run records `last_error` on the failing feed, leaves `user_availability`
untouched, and the UI surfaces the error next to that feed. Partial success is deliberately not
supported: syncing the union of the feeds that happened to respond has exactly the same
widening failure, just smaller.

### D6 — Conditional GET only within the same local day

Feeds store `etag` / `last_modified` and send `If-None-Match` / `If-Modified-Since`. But because
event bodies are never persisted (D8), a `304` leaves nothing to recompute from — and the
horizon rolls daily, so yesterday's result is not today's. Therefore conditional headers are sent
**only when `last_synced_at` falls on the current local day**; on the first run of a day the
fetch is unconditional. Within a day, an all-`304` run short-circuits with no write at all.

### D7 — Echo-loop guard

If a user subscribes their calendar to the outbound feed (D9) *and* lists that calendar as an
inbound feed, Tourenbuddy's own tours would return as events and mark their own tour days busy.
D4 already defuses this — outbound events are all-day, and all-day events are ignored — but some
clients rewrite a subscribed event into a timed one on copy. The parser therefore also drops any
`VEVENT` whose `UID` ends in `@tourenbuddy` (the outbound minting suffix). Belt and braces, two
lines.

### D8 — Derive and discard

The Worker holds the parsed calendar in memory only. What crosses into Postgres is a `date[]`.
No title, location, description, attendee or organizer is written anywhere, including logs —
error logging records the feed id and HTTP status, never the body. The feed URL is a bearer
credential: `user_calendar_feeds` is owner-only RLS, the Worker reads it with the service role,
and the UI masks all but the host when displaying a saved feed.

### D9 — Outbound: live-rendered token feed

`GET /calendar/:token.ics` on the Worker. The token (`user_calendar_settings.feed_token`, a
uuid) resolves to a user; the handler then queries, **at request time**, the user's
`planned_date`-bearing tours plus tours sharing a `tour_link_group` with one of them, and renders
`VEVENT`s with `DTSTART;VALUE=DATE`, `UID:tour-<id>@tourenbuddy` and
`PRODID:-//Tourenbuddy//Tours//EN`.

Live rendering is what makes including *linked* tours — other users' data — defensible: when a
link dissolves, the next calendar refresh drops the event with no revocation job, no stored
snapshot and no cache to invalidate. `Cache-Control: private, max-age=900`.

### D10 — Cron on the existing Worker

`[triggers] crons = ["0 */6 * * *"]` plus a `scheduled()` export on `services/email-hook`. It
already has the Supabase service-role credentials and a deploy path. A second Worker would mean
a second deploy, a second secret set and a second thing to forget. The scheduled run pages
through users that have at least one feed; `POST /calendar/sync` runs the identical routine for
one authenticated caller so that adding a feed shows a result immediately.

**Deployment hazard:** Worker deploys are manual (`.claude/env-ci.md`). Shipping the frontend
without `npx wrangler deploy` yields a Calendar-sync UI whose feeds never sync and whose
outbound URL 404s, with no error anywhere. Explicit task, not a footnote.

## Risks / Trade-offs

- **Google's ICS republish lag** can exceed the 6 h cron. Mitigated by the manual sync action
  and by the fact that the user can always toggle a day by hand — which then pins it (D2).
- **Tombstone accumulation.** Bounded in practice: only written while a feed exists, and only
  for days the user actively cleared. A housekeeping delete of `available = false` rows older
  than today runs inside the same sync RPC.
- **A user who never opens Tourenbuddy still syncs.** The cron iterates all users with feeds.
  Bounded by feed count and one HTTP fetch each; revisit with a "last active" filter if the
  Worker's CPU budget becomes visible.
- **Users with no feed pay nothing.** No behavioural change: no tombstones, no new rows, the
  same RPC signature.
