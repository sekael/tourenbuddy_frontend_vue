## Why

The notification inbox (#300) shipped with the events that existed at the time; the two remaining event families from the issue — friend availability and new-feature announcements — were deferred. Availability is only useful when it lines up with your own free days, and release notes today never reach users at all, so both are invisible unless someone opens the calendar or reads the changelog.

## What Changes

- **Availability overlap entries**: when a friend's newly-available future day overlaps a day you are available, you get one inbox entry naming the friend and the overlapping days. Covers manual marks and calendar-sync days. Repeats from the same friend collapse into the unread entry (dates merged). Tapping opens the calendar on the first overlapping day.
- **New mutable type `availability`**: overlap entries push/email like other types, honoring mutes and the email channel; listed in the preferences mute section.
- **Release-note entries**: notes are bundled with the app (i18n, keyed by version). On the first run of a build that carries a note, the client records one inbox entry for the user via an idempotent RPC. Inbox-only — never pushed or emailed, not mutable. Users created after the note's release date don't get it. Tapping opens the note.
- **Database**: `notifications.type` check widened to `availability` and `release_notes`; availability emission trigger on `user_availability`; collapse extended to availability; dispatch trigger skips release notes; unfriend cleanup also removes availability entries caused by the ex-friend.
- **Worker**: push/email copy for availability overlap. Requires a manual `wrangler deploy`.
- **Explicitly not included**: push retry / `dispatched_at` — push stays at-most-once; the inbox remains the record.

## Capabilities

### New Capabilities
- `availability-overlap-notifications`: when an availability overlap event fires, who receives it, collapse and cleanup rules, delivery.
- `release-notes`: bundled release notes delivered once per user as an inbox entry, eligibility and display.

### Modified Capabilities
- `notification-inbox`: event coverage adds availability overlap and release notes; collapse rule extends to availability; deep-link targets (calendar day, release note); staleness for availability; users may create their own release-note entry through the dedicated RPC only.
- `notifications`: the mutable type set gains `availability`; release notes are not a mutable type.

## Impact

- **DB**: one new migration (type check, triggers, helper collapse, `record_release_note` RPC, dispatch trigger condition, unfriend cleanup); new pgTAP cases in `supabase/tests/notifications_rls.sql`.
- **Worker** (`services/email-hook`): copy for `(availability, overlap)`; manual deploy.
- **Client**: `features/notifications` (types split into inbox vs. mutable sets, entry rendering, deep links, release-note sheet, release-note registry), app version exposed via Vite `define`, i18n (`en`, `de-CH`), guided tour unaffected (no new controls).
- **Rollout**: old PWA builds drop rows of unknown types (already handled by `parseInboxRows`), so they simply don't show the new entries until updated.
