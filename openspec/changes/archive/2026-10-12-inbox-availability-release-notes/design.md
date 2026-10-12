# Design

## Context

- The inbox (archived change `2026-10-12-notification-inbox`) records every event in `public.notifications` through one helper, `fn_emit_notification` (actor never a recipient, no actor ⇒ no event, never raises, collapses unread repeats for `updated` / `collision`). An `AFTER INSERT` trigger posts each new row to the Worker via `pg_net`; at-most-once, no retry. Push URLs are always `/?notification=<id>`; the client deep-links from the entry.
- `notifications.type` has a `CHECK` limited to the four mute types — a migration is required for new types.
- `pg_cron` is already enabled (`purge-old-notifications`, `20261008073323_notification_inbox.sql`).
- Availability lives in `user_availability (user_id, date, available, source)`; tombstones are `available = false`. Calendar sync marks any day with ≥ 6 h free core time available, so calendar users are "available" on most days.
- Tours: `tours (user_id, planned_date, completed, visibility in ('private','friends'))`; partners are owner contacts in `tour_partners`, resolved to accounts by `tour_partner_user_ids(tour_id)` (definer, confirmed phones only).
- Client: `ALL_NOTIFICATION_TYPES` serves both the mute list and the inbox row schema; `parseInboxRows` drops rows of unknown type. `/calendar?day=YYYY-MM-DD` already focuses a day.

## Goals / Non-Goals

**Goals:**
- A low-noise availability signal: at most one entry per user per week, only for friends you already share a plan with.
- A reminder before planned tours, without per-tour state.
- Release notes recorded exactly once per user, surviving entry deletion and the 90-day retention, without guessing the release version.

**Non-Goals:**
- Event-driven availability overlap (rejected during review: calendar sync made it fire daily).
- Push retry / `dispatched_at` (pushes stay at-most-once; a missed cron run is lost).
- Backfilling intermediate release notes; per-note targeting.
- Availability-based suggestions beyond the weekly summary (#301 preferences stay separate).

## Decisions

### D1 — Shared-tour gate
A friend F counts for user U when an accepted friendship exists and a tour exists with `completed = false`, `visibility = 'friends'`, and either (U owns it and F ∈ `tour_partner_user_ids`) or (F owns it and U ∈ `tour_partner_user_ids`). The tour's `planned_date` is irrelevant. Private tours never count: partners can't see their details, so they must not cause notifications.
- *Alternative — co-partners on a third person's tour*: the shared plan belongs to someone outside the pair, and needs a scan of every tour listing both. Rejected; add if asked.

### D2 — Weekly availability summary via `pg_cron`
`fn_weekly_availability_summary()` (definer, never raises) scheduled `0 5 * * 1` (UTC ≈ 06:00/07:00 Zurich; DST drift accepted). Window: `current_date` .. `current_date + 6`. In one transaction:
1. Delete `type = 'availability'` rows whose `ref->>'week_start'` is before `current_date` (last week's summaries, read or not).
2. For each U, collect gated friends F with an `available` row on a date in the window where U also has an `available` row (either source). Insert one row per U: `type 'availability'`, `action 'weekly'`, no actor, `ref = { week_start, friend_ids[], dates[] }` (dates sorted, distinct), guarded by `not exists` on `(recipient, type, ref->>'week_start')` so a re-run inserts nothing.

Names are resolved at display time (client, and Worker for push copy) from `friend_ids` — no stored name snapshot.
- *Alternative — event-driven trigger on `user_availability`* (original D1): calendar sync rolls its horizon daily, so a pair with feeds would get a push most days. Rejected. Trade-off accepted: a day marked on Tuesday surfaces only next Monday.

### D3 — Tour reminders via `pg_cron`
`fn_tour_reminders()` (definer, never raises) scheduled daily `0 5 * * *`. Selects tours with `completed = false and planned_date = current_date + 5` (exact equality, stateless). Recipients: owner; plus, when `visibility = 'friends'`, partners from `tour_partner_user_ids` who are friends of the owner. Insert `type 'tour_reminders'`, `action 'upcoming'`, no actor, `tour_id`/`tour_name` set, `ref = { planned_date }`, guarded by `not exists` on `(recipient, tour_id, ref->>'planned_date')`.
- Tours planned < 5 days ahead get no reminder (the user just chose the date). A date moved to ≥ 5 days ahead reminds again (new plan).
- Existing access-loss cleanup (`20261010065119_notification_visibility_cleanup.sql`) already deletes a user's entries by `tour_id`, so reminders vanish with access for free.
- *Alternative — "≤ 5 days and not yet reminded"*: needs a per-(tour, date) marker. Rejected.

### D4 — Direct inserts, not `fn_emit_notification`
Both jobs have no actor; the helper's "no actor ⇒ silent" rule would drop them, and making the owner the actor would exclude the owner. The jobs insert directly (as the release-note RPC does). The `AFTER INSERT` dispatch trigger still pushes them.

### D5 — Two type sets on the client, one wider DB check
Migration replaces `notifications_type_check` with seven values (`availability`, `tour_reminders`, `release_notes` added). Client splits `MUTABLE_NOTIFICATION_TYPES` (six, drives preferences + `notif_muted_types` parsing) from `INBOX_NOTIFICATION_TYPES` (seven, drives the inbox row schema). Worker's `NotificationType` gains the two mutable types; its mute check keeps using `row.type`. Both new types are on by default (mute list semantics, no data migration on `user_profile` — which would bump `updated_at` and false-conflict queued offline profile edits under LWW).
- `tour_reminders` is separate from `tour_updates` for the same reason `tour_suggestions` is: muting edit noise must not silence what needs attention.

### D6 — Release notes keyed by a hand-picked id, not a version
Registry `features/notifications/data/release-notes.ts`: `{ id, since }[]`, `id` a unique string chosen when writing the note (e.g. `'2026-10-availability-reminders'`), `since` the authoring date (`YYYY-MM-DD`). The current note is the **last** entry — ids only need to differ, no ordering or semver. Copy in i18n under `releaseNotes.<id>.{title,body}` (`en`, `de-CH`); the copy says "What's new", never a version.
- *Alternative — key by app version* (`__APP_VERSION__` via Vite `define`): the version is assigned by release-please after the note is written; a wrong guess hides the note. Rejected.
- Preview builds carry the note and share the prod Supabase project, so a tester may record it before release. Accepted: they just don't get it again.

### D7 — `record_release_note(p_note_id, p_since)` + per-user marker table
New table `user_release_note_state (user_id pk → auth.users on delete cascade, last_note_id text not null)`. Definer RPC: validate `p_note_id ~ '^[a-z0-9-]{1,64}$'`; return false if the caller's `auth.users.created_at::date > p_since`; if `last_note_id` already equals `p_note_id`, return false; otherwise upsert the marker and insert one `notifications` row (`type 'release_notes'`, `action 'published'`, no actor, `ref {note_id}`) for the caller. Returns whether an entry was created.
- Marker instead of a unique index on `notifications`: deleting the entry or the 90-day purge would let the note come back.
- Separate table instead of a `user_profile` column: avoids bumping the profile's `updated_at` (LWW false conflict) and profile realtime.
- Grants: deliberate deviation from the `grant all` template (as with `notifications`): `revoke all … from anon, authenticated; grant all … to service_role;` RLS on, no policies. The RPC is the only door.
- Forgery: a client can pass any id/date, but only ever affects its own inbox; an unknown id renders "no longer available".
- Rollback flip-flop (build with note B, then back to A) re-records A once. Accepted.

### D8 — Release notes never dispatch
`trg_dispatch_notification` is recreated with `when (new.type <> 'release_notes')`, avoiding a `pg_net` request per user per release.

### D9 — Client recording and rendering
- Inbox store, after auth and while `isOnline`: call `record_release_note` for the current note once per app start (idempotent server-side); on failure log and leave it to the next online start. Realtime delivers the row like any other.
- Availability summary: icon `event_available` (registry entry in `core/components/icons.ts`); text "{first friend} and N more are free on days you're free this week" with names from the friends store; opens `/calendar?day=<first date ≥ today>`; never stale (purged after the week).
- Tour reminder: tour icon, "“{tour}” is in 5 days"; opens the tour through the existing tour deep link and access check; stale under the existing tour rules.
- Release-note entry: opens the note in the existing dialog component (imperative, not a route); unknown id → `inbox.unavailable` snackbar; never stale.
- Preferences: two new mute rows (`en`, `de-CH`). Walk the guided tour to confirm its preferences copy still matches.

### D10 — Worker copy
Actor-less copy (`en`, `de-CH`, recipient locale), URL unchanged (`/?notification=<id>`):
- `(availability, weekly)`: "{first friend} and N more are free this week when you are" — first friend's name looked up from `ref.friend_ids[0]` at dispatch.
- `(tour_reminders, upcoming)`: "“{tour}” is in 5 days".
Email via the existing generic Brevo template with `action = 'availability_weekly'` / `'tour_reminder'`.

## Risks / Trade-offs

- [Weekly job inserts one row per eligible user at once → a burst of `pg_net` dispatches] → one Worker invocation each, well under free-tier limits at current scale; batch if it shows up.
- [Old builds re-save `notif_muted_types` without the new types (they filter unknown values), silently unmuting them] → only when such a user edits prefs before updating; short window, accepted.
- [`current_date` is UTC; cron runs 05:00 UTC] → Monday window and 5-day offset are on UTC dates; at 05:00 UTC that equals the Swiss date. Harmless.
- [A missed cron run loses that day's reminders / that week's summary] → at-most-once like push; accepted.
- [Release-note copy lives only in the bundle] → never remove registry entries; keep old notes (cheap).

## Migration Plan

1. One migration (local first, `supabase db reset`, `supabase test db`): type check, the two job functions + `cron.schedule`, `user_release_note_state` + `record_release_note`, dispatch trigger condition.
2. Deploy order: `npx wrangler@latest deploy` (Worker understands the new types first) → `supabase db push` (prompt owner) → merge frontend.
3. Rollback: new migration with `cron.unschedule` for both jobs (emission stops); release notes stop by shipping a build without a newer note. Rows already recorded stay valid for current builds.

## Open Questions

- Content of the first release note — authored at implementation time; announces the weekly summary and reminders and points to Preferences.
