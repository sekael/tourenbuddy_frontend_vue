# Tasks

## 1. Git Setup

- [x] 1.1 Create the feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/300-inbox-availability-release-notes` (in the container `git fetch` fails — branch from local `main` and say so); verify `git branch --show-current`

## 2. Database

- [ ] 2.1 `supabase migration new inbox_availability_release_notes`: replace `notifications_type_check` with the seven types (D5); verify pgTAP: inserting `availability`, `tour_reminders`, `release_notes` rows as service role succeeds, an unknown type fails
- [ ] 2.2 Same migration: shared-tour gate (D1) + `fn_weekly_availability_summary()` (definer, never raises) and `cron.schedule('weekly-availability-summary', '0 5 * * 1', …)` — purge previous weeks, insert one actor-less row per user with `ref {week_start, friend_ids, dates}`, `not exists` guard (D2, D4); verify pgTAP: overlap with partner-on-own-tour and partner-on-friend's-tour → one entry listing all friends and dates; private tour / completed tour / no shared tour / overlap next week → none; manual and calendar rows both count; second run → no new row; last week's rows (read and unread) deleted
- [ ] 2.3 Same migration: `fn_tour_reminders()` (definer, never raises) and `cron.schedule('tour-reminders', '0 5 * * *', …)` — exact `planned_date = current_date + 5`, owner + friend partners on friends-visible tours, actor-less, `ref {planned_date}`, `not exists` guard (D3, D4); verify pgTAP: owner and friend partner reminded; private tour → owner only; non-friend partner, completed, no date, 4 or 6 days ahead → none; second run → no new row; moved date reminds again
- [ ] 2.4 Same migration: `user_release_note_state` (revoke from anon/authenticated, `grant all` to service_role, RLS on, no policies) + `record_release_note(p_note_id, p_since)` definer RPC (D7); verify pgTAP: first call creates one entry, second call and call after deleting the entry create none, a different id creates one, account created after `p_since` gets none, malformed id rejected, direct table access rejected
- [ ] 2.5 Same migration: recreate `trg_dispatch_notification` with `when (new.type <> 'release_notes')` (D8); verify pgTAP: trigger definition shows the `WHEN` clause
- [ ] 2.6 Apply locally (`supabase db reset`), run `supabase test db`; all files pass

## 3. Worker (`services/email-hook`)

- [ ] 3.1 Add `availability` and `tour_reminders` to `NotificationType`; actor-less push copy (`en`, `de-CH`) for `(availability, weekly)` (first friend name looked up from `ref.friend_ids[0]` + count) and `(tour_reminders, upcoming)`; URL stays `/?notification=<id>`; email via generic template with `action = 'availability_weekly'` / `'tour_reminder'` (D10); verify Worker unit tests for copy (incl. single friend, deleted first friend), mute check; `npx tsc --noEmit` passes
- [ ] 3.2 Update `services/email-hook/SETUP-NOTIFICATIONS.md` and `docs/notifications.md` (two new types, cron jobs, release notes never dispatched); verify grep shows all three types documented

## 4. Client — types, summary and reminder entries

- [ ] 4.1 Split `MUTABLE_NOTIFICATION_TYPES` (6) / `INBOX_NOTIFICATION_TYPES` (7) and wire prefs parsing vs. inbox row schema (D5); verify unit tests: prefs parse keeps both new types, inbox schema accepts `release_notes`, still drops unknown types
- [ ] 4.2 Preferences: `availability` and `tour_reminders` mute rows with label/description (`en`, `de-CH`); verify component test renders six rows and no release-notes row
- [ ] 4.3 Availability summary rendering: `event_available` icon registered in `core/components/icons.ts`, "{first friend} and N more" with names from the friends store, never stale (D9); verify component/unit tests: one friend, several friends, unknown friend id
- [ ] 4.4 Availability deep link opens `/calendar?day=<first listed day ≥ today>` and marks read; verify unit test incl. summary whose first day already passed
- [ ] 4.5 Tour reminder rendering + deep link through the existing tour access check and stale rules; verify component test: opens tour, lost access → `inbox.unavailable`

## 5. Client — release notes

- [ ] 5.1 Registry `features/notifications/data/release-notes.ts` (`{ id, since }[]`, current = last entry, header comment: ids unique, never remove entries) + first note copy in `en`/`de-CH` announcing the weekly summary and reminders and pointing to Preferences (D6); verify unit tests: empty registry → no note, current is the last entry, ids unique and match the RPC's id pattern
- [ ] 5.2 Repository + inbox store: call `record_release_note` once per app start when signed in and online; log and skip on failure or offline (D9); verify store tests: offline → not called, failure → no throw, online → called once with the current note
- [ ] 5.3 Release-note entry: renders note title, opens note dialog, marks read, unknown id → `inbox.unavailable` snackbar, never stale; verify component tests
- [ ] 5.4 Walk the guided tour end-to-end (preferences copy still accurate with two new rows); verify by running the app

## 6. Integration verification

- [ ] 6.1 Local end-to-end (`supabase start` + `wrangler dev`): run both job functions by hand (`select public.fn_weekly_availability_summary()` / `fn_tour_reminders()`) → expected entries + pushes, second run → nothing; new build with a note → one entry on two devices, none after delete + reload, no push
- [ ] 6.2 `npm run test`, `npm run type-check`, `supabase test db` all pass

## 7. Finalize

- [ ] 7.1 Run `npx eslint src test --fix` (not `.`, sweeps worktrees) and verify zero warnings; never `npm run format`
- [ ] 7.2 Prompt owner to commit with a ready-to-copy message, e.g. `feat(notifications): weekly availability summary, tour reminders and release notes` (body: refs #300)
- [ ] 7.3 Prompt owner to push and open a PR to `main`, listing deploy order: `npx wrangler@latest deploy` → `supabase db push` → merge

## Workflow follow-up

- Archive the change with `openspec-archive` after merge and deploy.
