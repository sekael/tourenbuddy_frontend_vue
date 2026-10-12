# Design

## Context

- The inbox (archived change `2026-10-12-notification-inbox`) records every event in `public.notifications` through one helper, `fn_emit_notification` (actor never a recipient, no actor ⇒ no event, never raises, collapses unread repeats for `updated` / `collision`). An `AFTER INSERT` trigger posts each new row to the Worker via `pg_net`; at-most-once, no retry.
- `notifications.type` has a `CHECK` limited to the four mute types — the earlier note that new types need no schema change was wrong; a migration is required.
- Availability lives in `user_availability (user_id, date, available, source)`. Writers: `apply_availability_diff` (manual, invoker, as the user) and `apply_calendar_availability` (calendar sync, service role, `auth.uid()` is null). Both already avoid re-writing unchanged rows. Tombstones are `available = false`.
- Client: `ALL_NOTIFICATION_TYPES` serves both the mute list and the inbox row schema; `parseInboxRows` drops rows of unknown type. `/calendar?day=YYYY-MM-DD` already focuses a day. The app version is not exposed to the bundle today.

## Goals / Non-Goals

**Goals:**
- Availability overlap emitted by the database for every write path, including calendar sync.
- Release notes recorded exactly once per user, surviving entry deletion and the 90-day retention.

**Non-Goals:**
- Push retry / `dispatched_at` (pushes stay at-most-once).
- Backfilling intermediate release notes; per-note targeting (all eligible users get every note).
- Availability-based suggestions beyond "a friend is free when you are" (#301 preferences stay separate).

## Decisions

### D1 — Availability emission is a statement-level trigger on `user_availability`
Two `AFTER INSERT` / `AFTER UPDATE … REFERENCING NEW TABLE (+ OLD TABLE)` statement triggers share one `security definer` function (transition tables require single-event triggers). Newly available = new row `available` and (inserted, or old row was `false`), `date >= current_date`. Grouped by the row's `user_id`, joined to friendships and to friends' `available` rows on the same dates; one `fn_emit_notification(array[friend], 'availability', 'overlap', p_ref => {dates}, p_actor => user_id)` per friend. Explicit `p_actor` is required because calendar sync runs without `auth.uid()`; the helper's "no actor ⇒ silent" rule still protects every other service-role write.
- *Alternative — emit inside the two RPCs*: two sites to keep in sync and misses direct table writes the grants allow. Rejected.
- *Alternative — row-level trigger*: one event per day per friend; a 30-day calendar sync would emit 30 times. Rejected.

### D2 — Collapse merges days
`fn_emit_notification`'s collapse list gains `('availability', 'overlap')`; matching uses the existing `(recipient, type, action, tour_id is not distinct from, actor)` key (tour is null). On collapse, `ref.dates` becomes the sorted union. `occurrences` still increments (unused in the availability copy, which shows the day count). Collapsed updates never push (existing `AFTER INSERT` dispatch).

### D3 — Two type sets on the client, one wider DB check
Migration replaces `notifications_type_check` with six values (`availability`, `release_notes` added). Client splits `MUTABLE_NOTIFICATION_TYPES` (five, drives preferences + `notif_muted_types` parsing) from `INBOX_NOTIFICATION_TYPES` (six, drives the inbox row schema). Worker's `NotificationType` gains `availability`; its mute check keeps using `row.type` unchanged.

### D4 — Release notes are bundled; version comes from `package.json`
Registry `features/notifications/data/release-notes.ts`: `{ version, releasedOn }[]`; copy in i18n under `releaseNotes.<version_with_underscores>.{title,body}` (`en`, `de-CH`). Vite `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` — release-please bumps `package.json` before the deploy build, so the running bundle knows its version. Selection: newest registry entry with semver ≤ `__APP_VERSION__`.
- *Alternative — server fanout from CI*: content in two places, a service-role secret in CI, users get notes before they have the build. Rejected (owner choice).

### D5 — `record_release_note(p_version, p_released_on)` + per-user marker table
New table `user_release_note_state (user_id pk → auth.users on delete cascade, last_version text not null)`. Definer RPC: validate `p_version ~ '^\d+\.\d+\.\d+$'`; return if the caller's `auth.users.created_at::date > p_released_on`; upsert the marker only when `p_version` is semver-greater than `last_version` (`string_to_array(v, '.')::int[]` comparison); if the marker moved, insert one `notifications` row (`type 'release_notes'`, `action 'published'`, no actor, `ref {version}`) for the caller. Returns whether an entry was created.
- Marker instead of a unique index on `notifications`: deleting the entry or the 90-day purge would let the note come back.
- Separate table instead of a `user_profile` column: the RPC bumping the profile's `updated_at` would false-conflict a queued offline profile edit under LWW (DC5) and fire profile realtime for nothing.
- Grants: deliberate deviation from the `grant all` template (as with `notifications`): no client access at all — `revoke all … from anon, authenticated; grant all … to service_role;` RLS enabled, no policies. The RPC is the only door.
- Forgery: a client can pass any version/date, but only ever affects its own inbox, and an unknown version renders "no longer available".

### D6 — Release notes never dispatch
`trg_dispatch_notification` is recreated with `when (new.type <> 'release_notes')`. Filtering in the trigger avoids a `pg_net` request per user per release.

### D7 — Client recording and rendering
- Inbox store, after auth and while `isOnline`: call `record_release_note` for the selected note once per app start (idempotent server-side, so no client bookkeeping); on failure log and leave it to the next online start. Realtime delivers the new row like any other.
- Availability entry: icon `event_available` (registry entry in `core/components/icons.ts`), text from actor + day count + first day; opens `/calendar?day=<earliest non-past day>`; stale ("Past") when every day is before today.
- Release-note entry: opens the note in the existing dialog component (imperative, not a route); unknown version → `inbox.unavailable` snackbar.
- Preferences: new `availability` mute row (`en`, `de-CH`). No new map controls, so the guided tour needs no new step — verify its preferences copy still matches.

### D8 — Unfriend clears availability entries
`fn_clear_notifications_on_unfriend` additionally deletes `type = 'availability'` entries whose actor is the other side, in both directions.

### D9 — Worker copy
`(availability, overlap)` push title/body (`en`, `de-CH`, recipient locale): "{actor} is free on {n} day(s) you're free too"; push URL `/calendar?day=<first>&notification=<id>`. Email via the existing generic Brevo template with `action = 'availability_overlap'`.

## Risks / Trade-offs

- [Calendar sync rolls the horizon daily, so a friend with a feed can create a new overlap entry (and push) every day after the previous one was read] → push only on overlap, collapse while unread, `availability` is mutable; revisit with a per-friend daily cap if it shows up.
- [Old builds re-save `notif_muted_types` without `availability` (they filter unknown values), silently unmuting it] → only when such a user edits prefs before updating; short window, accepted.
- [`current_date` is UTC; Swiss "today" differs for up to two hours around midnight] → at worst a just-passed day still counts as future; harmless.
- [Release-note copy lives only in the bundle; an entry recorded on build N shows "no longer available" if a later build drops the note] → never remove registry entries; keep old notes (cheap).

## Migration Plan

1. One migration (local first, `supabase db reset`, `supabase test db`): type check, helper collapse + ref merge, availability triggers, `user_release_note_state` + `record_release_note`, dispatch trigger condition, unfriend cleanup.
2. Deploy order: `npx wrangler@latest deploy` (Worker understands `availability` first) → `supabase db push` (prompt owner) → merge frontend.
3. Rollback: new migration dropping the two availability triggers (emission stops); release notes stop by shipping a build without newer notes. Rows already recorded stay valid for current builds.

## Open Questions

- Content of the first release note (which version and features) — authored at implementation time; does not affect the design.
