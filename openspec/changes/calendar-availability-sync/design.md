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

**An owner UPDATE policy is required.** #242 shipped owner policies for select/insert/delete
only. `apply_availability_diff` is `SECURITY INVOKER`, so tombstoning and re-marking a tombstone
(both UPDATEs) would silently match 0 rows without `user_availability_update_own`. The same
migration adds it. The re-mark upsert is `on conflict do update … where (available, source) is
distinct from (true, 'manual')`, so a row that is already manual-available is not UPDATEd.

**Security mode per function.** `apply_availability_diff` is `SECURITY INVOKER`: RLS limits the
caller to their own rows. `apply_calendar_availability` is also `SECURITY INVOKER`: only
`service_role` may execute it (`revoke … from public, anon, authenticated`), and `service_role`
bypasses RLS by itself (`BYPASSRLS`). Definer would only add the owner's privileges. The
execute grant is the gate; the `source = 'calendar'` filters inside the function enforce manual
precedence. RLS cannot express that rule, because manual and calendar rows belong to the same
user. The last-feed cleanup trigger is `SECURITY DEFINER`: it must work whoever deletes the feed,
including the auth admin role in the `auth.users` cascade, which has no rights on
`public.user_availability`. The sync RPC also drops `p_days` outside `[p_from, p_to]`, so the
horizon rule holds in the database, not just in the Worker.

**Pre-feed clears are plain deletes, deliberately.** Before a feed exists there is nothing to
override: clearing a day then is not a decision *against a calendar*. So a day cleared in July
with no feed may be re-greened by the first sync after a feed is connected in August. The user
sees that result immediately (on-demand sync on first connect) and can clear it again, which then
tombstones. Always-tombstoning would turn the table into a ledger of every un-tick for 100% of
users to protect a once-per-user transition.

**Pinning is asymmetric, and that is honest.** Only a *saved change* is a decision. A
calendar-derived green day that the user toggles off and back on nets to an empty diff, writes
nothing, and stays `source = 'calendar'`, so a later meeting may still remove it. Clearing pins
(tombstone); marking a non-green day pins (`manual` insert). There is no gesture to pin an
already-green calendar day, and none is needed: if a later meeting removes it, one tap re-marks it
as manual.

**Friend notification covers UPDATE.** The #244 broadcast trigger fires on `insert` and `delete`
only, which was complete while rows were only inserted or deleted. Tombstoning and re-marking a
tombstone are UPDATEs, so a third statement-level trigger `after update … referencing new table
as changed` reuses `fn_broadcast_availability_change` unchanged (its body is op-agnostic). The
calendar RPC upserts with `on conflict do nothing`, not `do update`: a conflicting row is either
already calendar-green (nothing to change) or manual (must not be touched), and `do update` would
UPDATE unchanged rows every run and ping every friend four times a day. An unchanged sync
therefore sends nothing: every statement runs, `changed` is empty, the trigger loop has no friends
to visit. One known exception: the past-tombstone housekeeping delete pings friends once per
expired tombstone. Accepted — one redundant refetch.

**Tombstones are hidden by RLS, not by the client.** The #244 friend SELECT policy is recreated
with `available and exists (…)`. Otherwise any friend with a session can query a user's
tombstones directly ("free in their calendar, deliberately declined"). `listFriendsFrom` then
needs no `available` filter; only `listOwnFrom` does, because the owner policy still returns
tombstones to the owner. `source` stays friend-readable: that a friend syncs a calendar is what
the feature openly does, not private information.

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

**Also ignored: cancelled and "show as free" events.** `STATUS:CANCELLED` (on a master or on a
single recurrence exception) and `TRANSP:TRANSPARENT` contribute no busy time. The user already
told their own calendar that the slot is free; counting it as busy would override that.

**Horizon `[today, today + 60d]`.** Beyond it the sync writes nothing, so untouched days stay
unmarked. An empty calendar in March is not a claim about March; friends act on these overlays.
The horizon rolls, so each run recomputes the whole window.

**All evaluation in `Europe/Zurich`.** ICS `DTSTART` arrives as UTC (`Z`), floating (no zone),
or `TZID`-qualified. Normalize via `ical.js`, then clip events to local day boundaries — a
Friday 18:00 → Sunday 20:00 event contributes busy time to three days, entirely outside the
core window on two of them. Recurrence is expanded with `ical.js`'s `RecurExpansion`; hand-rolled
RRULE (`BYSETPOS`, `EXDATE`, DST-crossing `UNTIL`) is a well-known trap and the library is
already the de-facto reference implementation. Expansion stops on the RRULE *slot*
(`RECURRENCE-ID`), never on an occurrence's moved start: slots arrive in order, moved starts do
not, and stopping at an exception moved past the horizon would drop every later occurrence —
silently freeing those days. Exceptions whose slot lies past the horizon are checked separately,
since one may be moved into it. `VTIMEZONE` components in the feed are
registered with `ical.js` so `TZID`-qualified times convert correctly. Floating times, and a `TZID`
that the feed does not define, are read as `Europe/Zurich` wall time rather than the Worker's UTC.
Every Zurich conversion (day keys, local wall time to instant) goes through
`src/calendar/zurich.ts` (`Intl.DateTimeFormat`), which handles 23 h and 25 h DST days.

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

**Disconnecting feeds.** A green day is not owned by any feed: it is green because *no* feed
blocked it (union of busy). So there is no `feed_id` on availability rows, and removing one of
several feeds can only free time, never make a green day wrong; the worst interim state is
under-reporting, the fail-safe direction. The client fires the on-demand sync after a non-last
removal. Removing the **last** feed is the one case that orphans rows, because no sync will ever
rewrite them again: an `after delete` trigger on `user_calendar_feeds`, when the user's feed count
reaches 0, deletes their `source = 'calendar'` rows and their tombstones. A trigger rather than
client code, because the row also disappears via the `auth.users` cascade and the dashboard.

**Input and size bounds.** Calendar apps commonly hand out `webcal://` (iCloud, many Outlook and
Nextcloud copy buttons). The Zod model normalizes `webcal://` → `https://` on input; the DB
`check (url like 'https://%')` stays as the trust-boundary backstop. The Worker caps a feed body
at **2 MB**, checked against `Content-Length` *and* by a running byte count while streaming
(the header may be absent or wrong); exceeding it is an ordinary feed failure, `last_error =
'too_large'`, fail closed. A secret ICS URL has no range parameter, so the download is always the
full history; "future only" applies to processing, not transport. `ical.js` parses the whole
capped body, then non-recurring events ending before the horizon are skipped. Pre-filtering the
raw text is rejected: a weekly `RRULE` with a 2019 `DTSTART` is past-dated but busies every week
of the horizon.

**Recurrence cap.** Expansion runs from each event's `DTSTART`, so an extreme rule
(`FREQ=MINUTELY` since 2010) could exhaust the Worker CPU budget. Expansion stops at 20,000
iterations per event and fails the feed with `last_error = 'too_complex'`, fail closed like
any other feed error. The upgrade path is to anchor the iterator near the horizon start if real
feeds ever hit the cap.

**Feed error codes** (`last_error`, shown in the UI): `http_<status>`, `timeout` (10 s),
`network`, `too_large`, `unparseable`, `too_complex`. `unparseable` also covers an event
`ical.js` rejects while reading it (no `DTSTART`, a garbage date): the library parses values
lazily, so those surface as raw errors mid-walk, and their messages can quote the feed (D8).

### D6 — Conditional GET only within the same local day

Feeds store `etag` / `last_modified` and send `If-None-Match` / `If-Modified-Since`. But because
event bodies are never persisted (D8), a `304` leaves nothing to recompute from — and the
horizon rolls daily, so yesterday's result is not today's. Therefore conditional headers are sent
**only when `last_synced_at` falls on the current local day**; on the first run of a day the
fetch is unconditional. Within a day, an all-`304` run short-circuits with no write at all.

**Mixed `304` / `200`.** If one feed changed and another answered `304`, the unchanged feed's
busy time is not in memory (D8), and deriving from the changed feed alone is exactly the partial
union D5 forbids. So every feed that answered `304` is refetched unconditionally in the same run
before derivation. Conditional GET therefore saves work only when *all* of a user's feeds are
unchanged. A `304` to an unconditional request is treated as an ordinary failure (`http_304`).

**On-demand is always unconditional.** Conditional GET is a cron-only optimization. The
on-demand sync runs right after a change no feed can report — new settings, a removed feed — so
an all-`304` short-circuit would skip exactly the recompute the user asked for.

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
uuid) resolves to a user; the handler then queries, at request time, **only that user's own**
`planned_date`-bearing tours and renders `VEVENT`s with `DTSTART;VALUE=DATE`,
`UID:tour-<id>@tourenbuddy` and `PRODID:-//Tourenbuddy//Tours//EN`. `Cache-Control: private,
max-age=900`.

`DTEND;VALUE=DATE` is exclusive, so it is `(end_date ?? planned_date) + 1 day`. That makes a
one-day tour one day long and a multi-day tour (`tours.end_date`, #tour-end-date) span its whole
range. Events are `TRANSP:TRANSPARENT`: a planned tour should not mark the user busy in other
tools that read their calendar. Text is escaped and lines are folded at 75 octets (never inside a
UTF-8 character) per RFC 5545. A malformed token is rejected before any query, and every miss
returns the same bare `404`.

**Own tours only.** Linking is a commitment to do the tour together, so linked tours belong in the
user's calendar, and they are already there: every tour the user is linked *through* is their own
tour. The event is rendered from the user's own row (their name, their date; link invariants do
not constrain `planned_date`). The friend's tour is never read. Including it was rejected: Google
and other subscribers fetch server-side and **store** the feed, so another user's tour data would
land in a third party under an account they never consented to, and "live rendering" would not
revoke it until the provider's next refresh.

**Revocable token.** The feed URL gets pasted into shared family calendars and forwarded. The UI
offers "Regenerate URL" (confirm dialog) → `update user_calendar_settings set feed_token =
gen_random_uuid()`; the old token 404s immediately.

### D10 — Cron on the existing Worker

`[triggers] crons = ["0 */6 * * *"]` plus a `scheduled()` export on `services/email-hook`. It
already has the Supabase service-role credentials and a deploy path. A second Worker would mean
a second deploy, a second secret set and a second thing to forget. The scheduled run pages
through users that have at least one feed; `POST /calendar/sync` runs the same routine,
unconditionally (D6), for one authenticated caller so that adding a feed shows a result
immediately.

**Deployment hazard:** Worker deploys are manual (`.claude/env-ci.md`). Shipping the frontend
without `npx wrangler deploy` yields a Calendar-sync UI whose feeds never sync and whose
outbound URL 404s, with no error anywhere. D11 makes this unreachable by ordering.

### D11 — Three PRs in dependency order, frontend last

Project rule: no frontend feature ships without a live backend — not behind a feature flag, not
under another tag. (A `VITE_*` flag would also cost a Zod env entry, a CI env step and a repo
secret, kept in sync.) So the change ships as three PRs, each inert on its own:

1. **DB** — feeds + settings tables **first** (the new `apply_availability_diff` body queries
   `user_calendar_feeds`), then `source`/`available`, both RPCs, the last-feed and update
   triggers, the tightened friend policy, and the `listOwnFrom` filter. With no feed rows the
   diff RPC plain-deletes as today: zero behaviour change. `supabase db push` after merge.
2. **Worker** — parse, busy-days, sync, cron, outbound, tests, then `wrangler deploy`. The cron
   finds zero feeds; every token 404s. Inert.
3. **Frontend** — repository, store, settings UI, edit-mode note, regenerate URL, locales. The
   backend is already live, so the UI works the moment it appears.

## Risks / Trade-offs

- **Google's ICS republish lag** can exceed the 6 h cron. Mitigated by the manual sync action
  and by the fact that the user can always toggle a day by hand — which then pins it (D2).
- **Tombstone accumulation.** Bounded in practice: only written while a feed exists, and only
  for days the user actively cleared. A housekeeping delete of `available = false` rows older
  than today runs inside the same sync RPC.
- **A user who never opens Tourenbuddy still syncs.** The cron iterates all users with feeds.
  Bounded by feed count and one HTTP fetch each; revisit with a "last active" filter if the
  Worker's CPU budget becomes visible.
- **Cloudflare Workers free plan (decided 2026-09-28).** The Worker stays on the free plan while
  Tourenbuddy is a test app: ~10 ms CPU and ~50 subrequests per invocation, cron included. A
  large ICS body (Google exports full history) can exceed the CPU budget in `ical.js` alone, and
  the cron's single-invocation paging costs ≈ users × (feeds + 3) subrequests, so it caps out
  around ~10 users. Accepted for now: test with **small calendars** only. Fail-closed still holds
  when the runtime kills an invocation (the per-user RPC is the only write and is atomic), but
  `last_error` is then **not** written either. **Symptoms that point here, not at a code bug:**
  `last_synced_at` stops advancing with no `last_error`; `exceededCpu` / "Too many subrequests"
  in Worker logs; on-demand `POST /calendar/sync` works while the cron does not. Upgrade path:
  paid plan (same code), then Queues fan-out (one message per user) past a few hundred users.
- **Users with no feed pay nothing.** No behavioural change: no tombstones, no new rows, the
  same RPC signature.
