## 1. Git Setup

- [ ] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/287-calendar-availability-sync`

## 2. Database — availability precedence (design D2)

- [ ] 2.1 `supabase migration new calendar_availability_source` — add `available boolean not null default true` and `source text not null default 'manual' check (source in ('manual','calendar'))` to `public.user_availability`. Existing rows backfill to `(true, 'manual')` via the defaults, which is exactly right: everything in there today was typed by a human. Index `(user_id, date) where available` is unnecessary — the composite PK already covers the read
- [ ] 2.2 Same migration — `create or replace function public.apply_availability_diff(added date[], removed date[])`, same signature (the client, the `mutate()` intent and the replay handler must stay untouched). Insert `added` as `(available = true, source = 'manual')` with `on conflict (user_id, date) do update`. For `removed`: tombstone (`available = false, source = 'manual'`) **only if** `exists (select 1 from public.user_calendar_feeds where user_id = auth.uid())`, otherwise plain delete. Keep `security invoker` + `set search_path = ''` — dropping either would break the owner-only RLS gate that makes this function safe. NEVER edit `20260710062534_create_user_availability.sql`
- [ ] 2.3 Same migration — `create function public.apply_calendar_availability(p_user_id uuid, p_from date, p_to date, p_days date[])`, `security definer`, `set search_path = ''`. Upsert `p_days` as `(available = true, source = 'calendar')`; delete `source = 'calendar'` rows in `[p_from, p_to]` not in `p_days`; delete `available = false` rows with `date < p_from` (tombstone housekeeping, design "Risks"). Every statement MUST carry `and source = 'calendar'` (or `available = false and date < p_from`) so a manual row can never be touched — the precedence is enforced here, not in the Worker. `revoke execute ... from anon, authenticated` and grant to `service_role` only: this function bypasses RLS and writes arbitrary `p_user_id`
- [ ] 2.4 `src/features/calendar/data/repositories/availability-repository-impl.ts` — add `.eq('available', true)` to both `listOwnFrom` and `listFriendsFrom`. Without this a tombstone renders as an available day, which is the exact inversion of what the user asked for
- [ ] 2.5 `supabase db reset` and verify: mark/clear with no feed leaves no tombstones; mark/clear with a feed row present leaves a tombstone; `apply_calendar_availability` cannot delete a manual row

## 3. Database — feeds and settings

- [ ] 3.1 `supabase migration new calendar_feeds_and_settings` — `public.user_calendar_feeds (id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, url text not null, label text, etag text, last_modified text, last_synced_at timestamptz, last_error text, created_at timestamptz not null default now(), unique (user_id, url))`. Add `check (url like 'https://%')`. Owner-only RLS for select/insert/update/delete. **Include the explicit Data API grants** (`grant all on table ... to anon, authenticated, service_role`) — a `create table` in `public` without them is invisible to PostgREST from 2026-10-30
- [ ] 3.2 Same migration — a `before insert` trigger enforcing at most 5 feeds per user, raising a named exception the UI maps to a localized message (never surface the raw Postgres text — the pattern to follow is `check_tour_attachment_limit` in `20260524033946_tour_attachments.sql`)
- [ ] 3.3 Same migration — `public.user_calendar_settings (user_id uuid primary key references auth.users(id) on delete cascade, core_start time not null default '06:00', core_end time not null default '18:00', min_free_minutes int not null default 360, feed_token uuid not null default gen_random_uuid() unique, created_at timestamptz not null default now())`, with `check (core_end > core_start)` and `check (min_free_minutes > 0 and min_free_minutes <= extract(epoch from (core_end - core_start)) / 60)` (design D3). Owner-only RLS + Data API grants. Do **not** put `feed_token` on `user_profile` — that table is friend-readable, and the token is a bearer credential
- [ ] 3.4 `supabase db reset`; verify the unsatisfiable-window constraint rejects `04:00–12:00` + `481` minutes, and that a second user cannot select either table's rows

## 4. Worker — busy-day derivation — **your gap**

- [ ] 4.1 `services/email-hook/package.json` — add `ical.js`. Do not hand-roll RRULE (design D4)
- [ ] 4.2 New `services/email-hook/src/calendar/parse-ics.ts` — parse an ICS body with `ical.js`, expand recurrences across `[from, to]`, drop all-day events (`DTSTART` with `VALUE=DATE`), drop any `VEVENT` whose `UID` ends in `@tourenbuddy` (design D7), and return a flat `{ start: Date, end: Date }[]` of timed occurrences in absolute time. Throw on an unparseable body — an empty result and a parse failure must be distinguishable (design D5)
- [ ] 4.3 New `services/email-hook/src/calendar/busy-days.ts` — implement `deriveAvailableDays(occurrences, { from, to, coreStart, coreEnd, minFreeMinutes })` per design D3, marked with `// TODO(me):`. For each local day in `[from, to]` in `Europe/Zurich`: clip every overlapping occurrence to that day's `[coreStart, coreEnd]`, merge the resulting intervals, take the largest gap (**including** the leading gap from `coreStart` and the trailing gap to `coreEnd` — a day whose only event ends at 09:00 is available because of the trailing gap, and forgetting the edges is the classic bug here), and emit the `YYYY-MM-DD` key when that gap is `>= minFreeMinutes`. Must handle: a multi-day occurrence contributing to several days; occurrences entirely outside the core window (no effect); an occurrence fully covering the window (busy); zero occurrences on a day (available); DST transition days, where the local day is 23 or 25 hours long. Use `Intl.DateTimeFormat` with `timeZone: 'Europe/Zurich'` for the local-day mapping — the Worker has no `TZ` and hand-rolled `+01:00/+02:00` offsets are wrong twice a year
- [ ] 4.4 `services/email-hook/test/calendar/busy-days.test.ts` — cover failure and edge cases only (`.claude/testing.md`): full working day → busy; two scattered 30-minute calls → available; union across two feeds each leaving 6 h alone but nothing jointly; event ending exactly at `coreStart`; event spanning Fri 18:00 → Sun 20:00; `minFreeMinutes` equal to the whole window; a DST-transition day

## 5. Worker — sync execution (design D5/D6/D8/D10)

- [ ] 5.1 New `services/email-hook/src/calendar/sync.ts` — `syncUser(env, userId)`: read that user's feeds + settings, fetch each feed (send `If-None-Match`/`If-Modified-Since` **only** when `last_synced_at` is on the current `Europe/Zurich` day, design D6), parse, union occurrences, derive, and call `apply_calendar_availability` once with the full 60-day window
- [ ] 5.2 Same file — fail closed: on any feed fetch/parse failure, write `last_error` for that feed, write **no** availability at all, and return without calling the RPC. Clear `last_error` on a feed that succeeds. Do not derive from the feeds that did respond (design D5) — a partial union has the same silent-widening failure, just smaller. Add a `ponytail:` comment naming this as deliberate
- [ ] 5.3 Same file — log feed id + HTTP status on failure and nothing else. No response bodies, no event fields, anywhere (design D8)
- [ ] 5.4 `services/email-hook/src/index.ts` — add `POST /calendar/sync`: verify the caller's Supabase JWT with the existing helper in `src/auth.ts`, then `syncUser` for that uid only. Reject unauthenticated calls
- [ ] 5.5 `services/email-hook/src/index.ts` + `wrangler.toml` — add `[triggers] crons = ["0 */6 * * *"]` and an exported `scheduled()` handler that pages through distinct `user_id`s in `user_calendar_feeds` and calls `syncUser` for each, isolating failures per user so one bad feed cannot abort the run

## 6. Worker — outbound tour feed (design D9)

- [ ] 6.1 New `services/email-hook/src/calendar/outbound.ts` — `renderTourFeed(tours)` producing a `VCALENDAR` with `PRODID:-//Tourenbuddy//Tours//EN` and one all-day `VEVENT` per tour: `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` (next day — `DTEND` is exclusive for date values, an easy off-by-one), `UID:tour-<id>@tourenbuddy`, `SUMMARY` from the tour name. Fold lines at 75 octets and escape `,` `;` `\` per RFC 5545
- [ ] 6.2 `services/email-hook/src/index.ts` — `GET /calendar/:token.ics`: resolve `user_calendar_settings.feed_token` → uid, then query **at request time** the uid's tours with a `planned_date` plus tours sharing a `tour_link_group` with one of them. Unknown token → bare 404, no hint about whether it ever existed. `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900`. No stored snapshot — live rendering is what makes shipping other users' linked tours revocable
- [ ] 6.3 `services/email-hook/test/calendar/outbound.test.ts` — a tour with no planned date is omitted; a name containing `,` and `;` is escaped; `DTEND` is the day after `DTSTART`; an unknown token yields 404

## 7. Frontend — feed management UI

- [ ] 7.1 New `src/features/calendar/domain/repositories/calendar-feed-repository.ts` + `data/repositories/calendar-feed-repository-impl.ts` + `data/models/calendar-feed.ts` (Zod) — list/add/remove/relabel feeds, read/update settings, trigger sync via `VITE_NOTIFY_HOOK_URL`. Follow `availability-repository-impl.ts` for shape
- [ ] 7.2 New `src/features/calendar/presentation/stores/calendar-feed-store.ts` — composition store with `loading` / `error` / data refs. Map the feed-limit exception and the settings check-constraint violation to localized messages; raw Postgres text MUST NOT reach the UI
- [ ] 7.3 New `src/features/calendar/presentation/components/calendar-sync-settings.vue` (≤150 lines; extract a `calendar-feed-row.vue` child if it grows) — feed list with masked URL + label + last-synced + per-feed error, add/remove, `<input type="time">` for the core window and a `<select>` for the minimum free block, plus the outbound feed URL with a copy button. Native inputs, no picker library. Reached from the existing profile/settings surface
- [ ] 7.4 After connecting a first feed, trigger an on-demand sync and refresh availability so the result is visible immediately rather than in six hours
- [ ] 7.5 `src/features/calendar/presentation/components/planned-calendar.vue` — when the user has ≥1 feed, add a line to the existing edit-mode disclaimer explaining that days come from their calendar and a tap pins the day permanently. No provenance styling on cells
- [ ] 7.6 `src/locales/en.json` + `src/locales/de-CH.json` — every new string in **both**, reusing existing keys where they exist

## 8. Frontend — tests

- [ ] 8.1 `test/features/calendar/` — store tests for the failure paths only: feed-limit rejection surfaces the localized message, an unsatisfiable window is rejected before the request, a sync-trigger failure sets `error` without clobbering loaded feeds. Mock the repository interface, never the Supabase client

## 9. Finalize

- [ ] 9.1 `npx eslint . --fix` (never `npm run format`), then `npm run type-check` and `npm run test` — all green
- [ ] 9.2 `cd services/email-hook && npm test` for the Worker suite
- [ ] 9.3 **Deploy the Worker manually** — `cd services/email-hook && npx wrangler@latest deploy`. This is NOT in CI (`.claude/env-ci.md`). Skipping it ships a Calendar-sync UI whose feeds never sync and whose outbound URL 404s, with no error surfaced anywhere
- [ ] 9.4 Prompt the user to `supabase db push` after review — never run it unprompted
- [ ] 9.5 Prompt the user to commit (never run `git commit`), offering:
      `feat(calendar): sync availability from ICS feeds and publish tours (#287)`
- [ ] 9.6 Prompt the user to push and open a PR against `main`
- [ ] 9.7 Prompt the user to archive this change with the `openspec-archive` skill
