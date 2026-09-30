> Ships as **three PRs in dependency order** (design D11). Each PR is inert on its own. No frontend
> ships before its backend is live, and there is no feature flag. Start PR 2 and PR 3 from `main`
> only after the previous PR has merged **and** been deployed (`db push` / `wrangler deploy`).

# PR 1 — Database (branch `feat/287-calendar-availability-sync`)

## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/287-calendar-availability-sync`

## 2. Database — feeds and settings (must come FIRST: `apply_availability_diff` queries `user_calendar_feeds`)

- [x] 2.1 `supabase migration new calendar_feeds_and_settings` — `public.user_calendar_feeds (id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, url text not null, label text, etag text, last_modified text, last_synced_at timestamptz, last_error text, created_at timestamptz not null default now(), unique (user_id, url))`. Add `check (url like 'https://%')` as the backstop (the client normalizes `webcal://`, design D5). Owner-only RLS for select/insert/update/delete. **Include the explicit Data API grants** (`grant all on table ... to anon, authenticated, service_role`) — a `create table` in `public` without them is invisible to PostgREST from 2026-10-30
- [x] 2.2 Same migration — a `before insert` trigger enforcing at most 5 feeds per user, raising a named exception the UI maps to a localized message (never surface the raw Postgres text — the pattern to follow is `check_tour_attachment_limit` in `20260524033946_tour_attachments.sql`)
- [x] 2.3 Same migration — `public.user_calendar_settings (user_id uuid primary key references auth.users(id) on delete cascade, core_start time not null default '06:00', core_end time not null default '18:00', min_free_minutes int not null default 360, feed_token uuid not null default gen_random_uuid() unique, created_at timestamptz not null default now())`, with `check (core_end > core_start)` and `check (min_free_minutes > 0 and min_free_minutes <= extract(epoch from (core_end - core_start)) / 60)` (design D3). Owner-only RLS + Data API grants. Do **not** put `feed_token` on `user_profile` — that table is friend-readable, and the token is a bearer credential

## 3. Database — availability precedence (design D2)

- [x] 3.1 `supabase migration new calendar_availability_source` — add `available boolean not null default true` and `source text not null default 'manual' check (source in ('manual','calendar'))` to `public.user_availability`. Existing rows backfill to `(true, 'manual')` via the defaults, which is exactly right: everything in there today was typed by a human
- [x] 3.2 Same migration — `create or replace function public.apply_availability_diff(added date[], removed date[])`, same signature (the client, the `mutate()` intent and the replay handler must stay untouched). Insert `added` as `(available = true, source = 'manual')` with `on conflict (user_id, date) do update`. For `removed`: tombstone (`available = false, source = 'manual'`) **only if** `exists (select 1 from public.user_calendar_feeds where user_id = auth.uid())`, otherwise plain delete (pre-feed clears are deliberately not tombstoned, design D2). Keep `security invoker` + `set search_path = ''`. NEVER edit `20260710062534_create_user_availability.sql`
- [x] 3.3 Same migration — `create function public.apply_calendar_availability(p_user_id uuid, p_from date, p_to date, p_days date[])`, `security definer`, `set search_path = ''`. Insert `p_days` as `(available = true, source = 'calendar')` with **`on conflict do nothing`** (never `do update`: it would touch manual rows or UPDATE unchanged rows and ping every friend each run, design D2); delete `source = 'calendar'` rows in `[p_from, p_to]` not in `p_days`; delete `available = false` rows with `date < p_from` (tombstone housekeeping — add a `ponytail:` comment that this pings friends once per expired tombstone, accepted). `revoke execute ... from anon, authenticated` and grant to `service_role` only: this function bypasses RLS and writes arbitrary `p_user_id`
- [x] 3.4 Same migration — third broadcast trigger `trg_broadcast_availability_update after update on public.user_availability referencing new table as changed for each statement execute function public.fn_broadcast_availability_change()`. Without it, tombstoning is invisible to friends (the #244 triggers cover insert/delete only)
- [x] 3.5 Same migration — `drop policy "user_availability_select_friend"` and recreate it with `using (available and exists (...))`, same friendship predicate as `20260713125720_friend_availability_access_and_realtime.sql`. Tombstones must be unreadable to friends at the RLS layer, not just filtered by the client
- [x] 3.6 Same migration — `after delete` trigger on `public.user_calendar_feeds`: when the deleted row's user has no remaining feeds, delete that user's `source = 'calendar'` rows and all `available = false` rows (design D5, "Disconnecting feeds"). Trigger, not client code — the cascade from `auth.users` and dashboard deletes must be covered too
- [x] 3.7 `src/features/calendar/data/repositories/availability-repository-impl.ts` — add `.eq('available', true)` to `listOwnFrom` only (the owner policy still returns tombstones to the owner). `listFriendsFrom` needs no filter: RLS already hides tombstones
- [x] 3.8 `supabase db reset` and verify: mark/clear with no feed leaves no tombstones; mark/clear with a feed row present leaves a tombstone; `apply_calendar_availability` cannot delete or modify a manual row; a friend session cannot select a tombstone; deleting the last feed leaves only manual available rows; an unsatisfiable window (`04:00–12:00` + `481`) is rejected; a second user cannot select either new table's rows
- [ ] 3.9 `npx eslint . --fix`, `npm run type-check`, `npm run test` — all green. Prompt the user to commit (`feat(calendar): availability source, tombstones and feed tables (#287)`), open the PR, and after merge prompt for `supabase db push` — never run it unprompted

# PR 2 — Worker (branch `feat/287-calendar-sync-worker`, from `main` after PR 1 is merged and pushed)

## 4. Worker — busy-day derivation — **your gap**

- [ ] 4.1 `services/email-hook/package.json` — add `ical.js`. Do not hand-roll RRULE (design D4)
- [ ] 4.2 New `services/email-hook/src/calendar/parse-ics.ts` — parse an ICS body with `ical.js`, skip non-recurring events ending before `from` (never pre-filter the raw text — a past-`DTSTART` `RRULE` is still live, design D5), expand recurrences across `[from, to]`, drop all-day events (`DTSTART` with `VALUE=DATE`), drop any `VEVENT` whose `UID` ends in `@tourenbuddy` (design D7), and return a flat `{ start: Date, end: Date }[]` of timed occurrences in absolute time. Throw on an unparseable body — an empty result and a parse failure must be distinguishable (design D5)
- [ ] 4.3 New `services/email-hook/src/calendar/busy-days.ts` — implement `deriveAvailableDays(occurrences, { from, to, coreStart, coreEnd, minFreeMinutes })` per design D3, marked with `// TODO(me):`. For each local day in `[from, to]` in `Europe/Zurich`: clip every overlapping occurrence to that day's `[coreStart, coreEnd]`, merge the resulting intervals, take the largest gap (**including** the leading gap from `coreStart` and the trailing gap to `coreEnd` — a day whose only event ends at 09:00 is available because of the trailing gap, and forgetting the edges is the classic bug here), and emit the `YYYY-MM-DD` key when that gap is `>= minFreeMinutes`. Must handle: a multi-day occurrence contributing to several days; occurrences entirely outside the core window (no effect); an occurrence fully covering the window (busy); zero occurrences on a day (available); DST transition days, where the local day is 23 or 25 hours long. Use `Intl.DateTimeFormat` with `timeZone: 'Europe/Zurich'` for the local-day mapping — the Worker has no `TZ` and hand-rolled `+01:00/+02:00` offsets are wrong twice a year
- [ ] 4.4 `services/email-hook/test/calendar/busy-days.test.ts` — cover failure and edge cases only (`.claude/testing.md`): full working day → busy; two scattered 30-minute calls → available; union across two feeds each leaving 6 h alone but nothing jointly; event ending exactly at `coreStart`; event spanning Fri 18:00 → Sun 20:00; `minFreeMinutes` equal to the whole window; a DST-transition day

## 5. Worker — sync execution (design D5/D6/D8/D10)

- [ ] 5.1 New `services/email-hook/src/calendar/sync.ts` — `syncUser(env, userId)`: read that user's feeds + settings, fetch each feed (send `If-None-Match`/`If-Modified-Since` **only** when `last_synced_at` is on the current `Europe/Zurich` day, design D6), parse, union occurrences, derive, and call `apply_calendar_availability` once with the full 60-day window
- [ ] 5.2 Same file — cap each body at 2 MB: reject on `Content-Length` over the cap **and** abort the stream read when a running byte count passes it. Oversize → `last_error = 'too_large'`, handled as any other feed failure (design D5)
- [ ] 5.3 Same file — fail closed: on any feed fetch/parse/size failure, write `last_error` for that feed, write **no** availability at all, and return without calling the RPC. Clear `last_error` on a feed that succeeds. Do not derive from the feeds that did respond (design D5) — a partial union has the same silent-widening failure, just smaller. Add a `ponytail:` comment naming this as deliberate
- [ ] 5.4 Same file — log feed id + HTTP status on failure and nothing else. No response bodies, no event fields, anywhere (design D8)
- [ ] 5.5 `services/email-hook/src/index.ts` — add `POST /calendar/sync`: verify the caller with `verifySupabaseJwt` from `src/auth.ts`, then `syncUser` for that uid only. Reject unauthenticated calls
- [ ] 5.6 `services/email-hook/src/index.ts` + `wrangler.toml` — add `[triggers] crons = ["0 */6 * * *"]` and an exported `scheduled()` handler that pages through distinct `user_id`s in `user_calendar_feeds` and calls `syncUser` for each, isolating failures per user so one bad feed cannot abort the run. `ponytail:` comment naming the free-plan ceiling (≈ users × (feeds + 3) subrequests per invocation) and the upgrade path (paid plan, then Queues fan-out) — design → Risks

## 6. Worker — outbound tour feed (design D9)

- [ ] 6.1 New `services/email-hook/src/calendar/outbound.ts` — `renderTourFeed(tours)` producing a `VCALENDAR` with `PRODID:-//Tourenbuddy//Tours//EN` and one all-day `VEVENT` per tour: `DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` (next day — `DTEND` is exclusive for date values, an easy off-by-one), `UID:tour-<id>@tourenbuddy`, `SUMMARY` from the tour name. Fold lines at 75 octets and escape `,` `;` `\` per RFC 5545
- [ ] 6.2 `services/email-hook/src/index.ts` — `GET /calendar/:token.ics`: resolve `user_calendar_settings.feed_token` → uid, then query at request time **only that uid's own** tours with a `planned_date`. No join to `tour_link_*` — a linked tour is already the user's own tour, and another user's tour data must never reach a subscribing provider (design D9). Unknown token → bare 404, no hint about whether it ever existed. `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900`
- [ ] 6.3 `services/email-hook/test/calendar/outbound.test.ts` — a tour with no planned date is omitted; a name containing `,` and `;` is escaped; `DTEND` is the day after `DTSTART`; an unknown token yields 404

## 7. Worker — finalize

- [ ] 7.1 `cd services/email-hook && npm test` — all green
- [ ] 7.2 Prompt the user to commit (`feat(email-hook): calendar sync cron and tour feed (#287)`) and open the PR
- [ ] 7.3 After merge, **deploy the Worker manually** — `cd services/email-hook && npx wrangler@latest deploy`. NOT in CI (`.claude/env-ci.md`). PR 3 must not start until this is done. Free plan: test with small calendars only (design → Risks lists the symptoms of hitting the limits)

# PR 3 — Frontend (branch `feat/287-calendar-sync-ui`, from `main` after PR 2 is merged and deployed)

## 8. Frontend — feed management UI

- [ ] 8.1 New `src/features/calendar/domain/repositories/calendar-feed-repository.ts` + `data/repositories/calendar-feed-repository-impl.ts` + `data/models/calendar-feed.ts` (Zod, with a `.transform` normalizing `webcal://` → `https://` and rejecting `http://`) — list/add/remove/relabel feeds, read/update settings, regenerate the feed token (`feed_token = gen_random_uuid()` via RPC or update), trigger sync via `VITE_NOTIFY_HOOK_URL`. Follow `availability-repository-impl.ts` for shape
- [ ] 8.2 New `src/features/calendar/presentation/stores/calendar-feed-store.ts` — composition store with `loading` / `error` / data refs. Map the feed-limit exception and the settings check-constraint violation to localized messages; raw Postgres text MUST NOT reach the UI. After removing a feed while others remain, trigger an on-demand sync (design D5)
- [ ] 8.3 New `src/features/calendar/presentation/components/calendar-sync-settings.vue` (≤150 lines; extract a `calendar-feed-row.vue` child if it grows) — feed list with masked URL + label + last-synced + per-feed error (incl. `too_large`), add/remove, `<input type="time">` for the core window and a `<select>` for the minimum free block, the outbound feed URL with a copy button and a "Regenerate URL" action behind a confirm dialog. Native inputs, no picker library. Reached from the existing profile/settings surface
- [ ] 8.4 After connecting a first feed, trigger an on-demand sync and refresh availability so the result is visible immediately rather than in six hours
- [ ] 8.5 `src/features/calendar/presentation/components/planned-calendar.vue` — when the user has ≥1 feed, add a line to the existing edit-mode disclaimer: days come from their calendar, and days they change here override it permanently. No provenance styling on cells
- [ ] 8.6 `src/locales/en.json` + `src/locales/de-CH.json` — every new string in **both**, reusing existing keys where they exist

## 9. Frontend — tests

- [ ] 9.1 `test/features/calendar/` — store tests for the failure paths only: feed-limit rejection surfaces the localized message, an unsatisfiable window is rejected before the request, a sync-trigger failure sets `error` without clobbering loaded feeds, a `webcal://` URL is normalized and an `http://` URL rejected. Mock the repository interface, never the Supabase client

## 10. Finalize

- [ ] 10.1 `npx eslint . --fix` (never `npm run format`), then `npm run type-check` and `npm run test` — all green
- [ ] 10.2 Prompt the user to commit (never run `git commit`), offering `feat(calendar): calendar sync settings UI (#287)`
- [ ] 10.3 Prompt the user to push and open a PR against `main`
- [ ] 10.4 Prompt the user to archive this change with the `openspec-archive` skill
