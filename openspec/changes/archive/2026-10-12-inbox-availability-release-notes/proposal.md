## Why

The notification inbox (#300) shipped with the events that existed at the time; the two remaining event families from the issue — friend availability and new-feature announcements — were deferred. Availability is only useful when it lines up with your own free days *and* with plans you already share, and release notes today never reach users at all. Planned tours also pass without any nudge to the people on them. All three are invisible unless someone opens the calendar or reads the changelog.

## What Changes

- **Weekly availability summary**: every Monday morning a scheduled job sends each user at most one inbox entry for the current week (Monday–Sunday) if at least one friend is available on a day the user is available **and** the two share a non-completed, friends-visible tour (one owns it, the other is a partner). The entry names the first friend plus a count; tapping opens the calendar. The next Monday run deletes the previous week's summaries.
- **Tour reminders**: a daily scheduled job reminds the owner — and, on friends-visible tours, partners who are friends of the owner — exactly 5 days before a non-completed tour's planned date. Tapping opens the tour.
- **New mutable types `availability` and `tour_reminders`**: both push/email like other types, honoring mutes and the email channel, listed in the preferences mute section, **on by default**.
- **Release-note entries**: notes are bundled with the app (i18n), identified by a hand-picked string id — no version. The current note is the last registry entry. On app start the client records it once per user via an idempotent RPC. Inbox-only — never pushed or emailed, not mutable. Users created after the note's date don't get it. Tapping opens the note. The first note announces the two new types and points to Preferences.
- **Database**: `notifications.type` check widened to seven values; two `pg_cron` jobs (weekly summary, daily reminders) inserting entries directly (no actor); release-note marker table + RPC; dispatch trigger skips release notes.
- **Worker**: actor-less push/email copy for `(availability, weekly)` and `(tour_reminders, upcoming)`. Requires a manual `wrangler deploy`.
- **Explicitly not included**: event-driven availability overlap (replaced by the weekly summary); push retry / `dispatched_at` — push stays at-most-once; the inbox remains the record.

## Capabilities

### New Capabilities
- `weekly-availability-summary`: the Monday summary — eligibility (shared tour gate), content, delivery, weekly purge.
- `tour-reminders`: the 5-day reminder — timing, recipients, delivery.
- `release-notes`: bundled release notes delivered once per user as an inbox entry, eligibility and display.

### Modified Capabilities
- `notification-inbox`: event coverage adds the weekly summary, tour reminders and release notes; deep-link targets (calendar, tour, release note); staleness for the new entries; users may create their own release-note entry through the dedicated RPC only.
- `notifications`: the mutable type set gains `availability` and `tour_reminders`; release notes are not a mutable type.

## Impact

- **DB**: one new migration (type check, two `pg_cron` jobs + their functions, `user_release_note_state` + `record_release_note` RPC, dispatch trigger condition); new pgTAP cases in `supabase/tests/notifications_rls.sql`.
- **Worker** (`services/email-hook`): actor-less copy for both new types; manual deploy.
- **Client**: `features/notifications` (types split into inbox vs. mutable sets, entry rendering, deep links, release-note sheet, release-note registry), i18n (`en`, `de-CH`), preferences gain two mute rows; guided tour copy re-checked.
- **Rollout**: old PWA builds drop rows of unknown types (already handled by `parseInboxRows`), so they simply don't show the new entries until updated.
