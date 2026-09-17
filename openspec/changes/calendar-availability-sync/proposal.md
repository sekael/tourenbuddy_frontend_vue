## Why

Issue #287: availability lives only in Tourenbuddy. A user who already keeps a work and a
private calendar has to maintain a third, parallel record of "which days am I free" by hand
on the Planned calendar (`planned-calendar.vue` edit mode → `apply_availability_diff`). The
extra step is the whole friction: friends read stale green overlays because nobody keeps a
fourth calendar current.

The issue asks for the options to be weighed before implementing. They were, with the
reporter:

| Option | User effort | Why not / why |
|---|---|---|
| Dedicated "Tourenbuddy" calendar, events = available (issue opt. 1) | **High** — user maintains a second event set | Unambiguous, but just moves the chore into another app. Fails the stated constraint. |
| Keyword tag (`#tb`) on events | High — tag every day | Typos; no removal signal |
| Dummy participant address invited to events (issue opt. 2) | Medium | Needs inbound email routing, MIME/ICS invite parsing, `METHOD:CANCEL` handling, per-user address minting, spam surface. Most moving parts, least reliable. **Rejected.** |
| Google / Microsoft OAuth API | Zero | Near-realtime push channels and true 2-way — but OAuth consent + app verification review, refresh-token storage in a Worker, and one integration per provider. Buys freshness that is not needed (hours is fine). **Rejected for v1.** |
| **Secret ICS feed URL, busy-derived** | **Zero** | One code path covers Google, Apple, Outlook and Nextcloud. No OAuth, no per-provider secrets. **Chosen.** |

Busy-derivation is the only inbound semantics that requires no extra event management. But a
calendar records *busy*, not free — absence of data is not evidence of freedom, and a single
18:00 dentist appointment must not consume a ski-touring day. So the calendar is treated as a
**seed, not a source of truth**: it pre-fills availability, and a manual toggle on the Planned
calendar pins that day forever. Every ambiguity the inversion creates is resolved by one tap in
UI that already exists.

Outbound is the mirror complaint and is nearly free: the user's planned tours are invisible in
the calendar app they actually live in.

## What Changes

- **A user connects up to 5 secret ICS feed URLs** (work + private + …) in a new *Calendar
  sync* section. Merge semantics across feeds are a **union of busy**: any feed says busy, the
  day is busy (design D5).
- **A day is available when its largest contiguous free block inside the user's core window is
  at least `min_free_minutes`** (design D3). Not "total busy minutes" — three scattered 30-minute
  calls are the signature of a working day, and a minutes-total rule scores that day as free.
  Not "any overlap" — that rule deletes the feature. `core_start`, `core_end` and
  `min_free_minutes` are **user-configurable in-app**, defaulting to 06:00 / 18:00 / 360, with a
  DB check constraint rejecting `min_free_minutes > (core_end − core_start)` — an unsatisfiable
  window must fail at input, not silently yield zero available days forever.
- **All-day events are ignored entirely** (design D4). Birthdays, name-days and public holidays
  would otherwise erase availability, and "Vacation" — an all-day event — means the *opposite*
  of busy for tour planning.
- **The calendar seeds, manual pins win.** `user_availability` gains `source`
  (`'manual' | 'calendar'`) and `available boolean`. A manual clear of a calendar-derived day
  writes a **tombstone** (`available = false, source = 'manual'`) rather than deleting the row,
  because a plain delete would be re-added by the very next sync (design D2). Readers filter
  `available = true`, so the rendering path, the friend-intersection query and the offline
  write-queue replay are unchanged in behaviour.
- **Rolling 60-day horizon.** Sync only writes inside `[today, today+60d]`. An empty calendar
  two years out is not evidence of availability, and friends act on these overlays (design D4).
- **Fail closed.** A feed that 404s, times out or whose secret URL was rotated returns zero busy
  events, which reads as *available every day*. If any connected feed fails, the whole sync for
  that user is skipped, prior state is kept, and `last_error` surfaces in the UI (design D5).
  This is the single most dangerous failure mode in the change.
- **Event text is never persisted.** The Worker derives per-day booleans and discards titles,
  locations, attendees and descriptions. The feed URL itself is a bearer credential and lives in
  an owner-only table the Worker reads with the service role (design D8).
- **Outbound: a per-user secret ICS feed** of the user's own planned tours **plus tours they are
  linked to**, served by the Worker and **rendered live per request** — the token resolves to a
  user, then tours and current `tour_link_member` rows are queried at request time, so a
  dissolved link disappears on the calendar app's next refresh with no stored snapshot to leak
  (design D9).
- **Polling runs on the existing `services/email-hook` Worker** via a 6-hourly cron trigger. It
  already holds `SUPABASE_SERVICE_ROLE_KEY`; this is a `[triggers]` block plus a `scheduled`
  handler, not new infrastructure (design D10). A `POST /calendar/sync` route syncs one
  authenticated user on demand, so adding a feed produces a result immediately instead of in six
  hours.

## Impact

- Affected specs: `calendar-availability` (MODIFIED — data model gains `source`/`available`,
  manual-clear tombstones, manual-wins precedence), `calendar-sync` (ADDED — feed management,
  busy derivation, sync execution, outbound feed)
- Affected code:
  - Migrations (new): `user_calendar_feeds`, `user_calendar_settings`, `user_availability`
    `source` + `available` columns, replaced `apply_availability_diff`, new
    `apply_calendar_availability` RPC (service-role only)
  - `services/email-hook/`: `wrangler.toml` (cron trigger), `src/index.ts` (scheduled handler,
    `/calendar/*` routes), new `src/calendar/` (ICS fetch, busy derivation, outbound render),
    `package.json` (`ical.js`), `test/`
  - `src/features/calendar/`: `data/models/availability.ts`, `availability-repository-impl.ts`
    (filter `available = true`), new feed/settings repository + store, new
    `calendar-sync-settings.vue`, `planned-calendar.vue` (edit-mode legend)
  - `src/locales/{en,de-CH}.json`
- **Worker deploy is manual and NOT in CI** (`.claude/env-ci.md`). Without
  `cd services/email-hook && npx wrangler deploy`, neither the cron nor the outbound feed
  exists in Preview or prod — the frontend would show a Calendar-sync UI that never syncs. It is
  an explicit task.
- **Non-goal:** OAuth calendar providers, write-back of availability into the user's calendar,
  intra-day availability (`user_availability` is day-keyed by design), per-canton holiday
  awareness, and real-time push channels.
- **Non-goal:** syncing a friend's availability from their calendar — feeds are strictly own-user.
