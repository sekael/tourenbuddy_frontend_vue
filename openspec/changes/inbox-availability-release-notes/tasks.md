# Tasks

## 1. Git Setup

- [ ] 1.1 Create the feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/300-inbox-availability-release-notes` (in the container `git fetch` fails — branch from local `main` and say so); verify `git branch --show-current`

## 2. Database

- [ ] 2.1 `supabase migration new inbox_availability_release_notes`: replace `notifications_type_check` with the six types; verify pgTAP: inserting an `availability` row as service role succeeds, an unknown type fails
- [ ] 2.2 Same migration: `fn_emit_notification` collapses `('availability','overlap')` and merges `ref.dates` (sorted union) on collapse (D2); verify pgTAP: two overlaps from the same friend while unread → one row, both dates, `occurrences = 2`
- [ ] 2.3 Same migration: availability emission — `security definer` function + `AFTER INSERT` and `AFTER UPDATE` statement triggers with transition tables on `user_availability`, explicit `p_actor`, never raises (D1); verify pgTAP: manual mark overlap, several days in one write → one entry, calendar-sync day notifies, re-save / past day / non-friend / clear are silent, actor never notified
- [ ] 2.4 Same migration: `user_release_note_state` (revoke from anon/authenticated, `grant all` to service_role, RLS on, no policies) + `record_release_note(p_version, p_released_on)` definer RPC (D5); verify pgTAP: first call creates one entry, second call and call after deleting the entry create none, newer version creates one, account created after release date gets none, malformed version rejected, direct table access rejected
- [ ] 2.5 Same migration: recreate `trg_dispatch_notification` with `when (new.type <> 'release_notes')` (D6) and extend `fn_clear_notifications_on_unfriend` to availability entries (D8); verify pgTAP: unfriend deletes both sides' availability entries; trigger definition shows the `WHEN` clause
- [ ] 2.6 Apply locally (`supabase db reset`), run `supabase test db`; all files pass

## 3. Worker (`services/email-hook`)

- [ ] 3.1 Add `availability` to `NotificationType`; push copy (`en`, `de-CH`) and push URL `/calendar?day=<first>&notification=<id>` for `(availability, overlap)`; email via generic template with `action = 'availability_overlap'` (D9); verify Worker unit test for copy, URL and mute; `npx tsc --noEmit` passes
- [ ] 3.2 Update `services/email-hook/SETUP-NOTIFICATIONS.md` and `docs/notifications.md` (new type, release notes never dispatched); verify grep shows both types documented

## 4. Client — types and availability entries

- [ ] 4.1 Split `MUTABLE_NOTIFICATION_TYPES` (5) / `INBOX_NOTIFICATION_TYPES` (6) and wire prefs parsing vs. inbox row schema (D3); verify unit tests: prefs parse keeps `availability`, inbox schema accepts `release_notes`, still drops unknown types
- [ ] 4.2 Preferences: `availability` mute row with label/description (`en`, `de-CH`); verify component test renders five rows and no release-notes row
- [ ] 4.3 Availability entry rendering: `event_available` icon registered in `core/components/icons.ts`, text with actor + day count + first day, "Past" stale chip when all days passed; verify component/unit tests for text, collapsed day count, stale rule
- [ ] 4.4 Availability deep link opens `/calendar?day=<earliest non-past day>` and marks read; verify unit test incl. entry whose first day already passed

## 5. Client — release notes

- [ ] 5.1 Vite `define` `__APP_VERSION__` from `package.json` (+ `env.d.ts` declaration and Vitest define); verify `npm run type-check` and a unit test reading it
- [ ] 5.2 Registry `features/notifications/data/release-notes.ts` + selection (newest ≤ app version, semver compare) + first note copy in `en`/`de-CH`; verify unit tests: no note, exact version, newer build picks newest older note, pre-release ordering `0.9.0 < 0.10.0`
- [ ] 5.3 Repository + inbox store: call `record_release_note` once per app start when signed in and online; log and skip on failure or offline (D7); verify store tests: offline → not called, failure → no throw, online → called once with the selected note
- [ ] 5.4 Release-note entry: renders note title, opens note dialog, marks read, unknown version → `inbox.unavailable` snackbar, never stale; verify component tests
- [ ] 5.5 Walk the guided tour end-to-end (no new targets expected; preferences copy still accurate); verify by running the app

## 6. Integration verification

- [ ] 6.1 Local end-to-end (`supabase start` + `wrangler dev`): two friends mark overlapping days → one inbox entry + one push, second overlap while unread → merged days, no push; new build with a note → one entry on two devices, none after delete + reload, no push
- [ ] 6.2 `npm run test`, `npm run type-check`, `supabase test db` all pass

## 7. Finalize

- [ ] 7.1 Run `npx eslint src test --fix` (not `.`, sweeps worktrees) and verify zero warnings; never `npm run format`
- [ ] 7.2 Prompt owner to commit with a ready-to-copy message, e.g. `feat(notifications): availability overlap and release-note inbox entries` (body: refs #300)
- [ ] 7.3 Prompt owner to push and open a PR to `main`, listing deploy order: `npx wrangler@latest deploy` → `supabase db push` → merge

## Workflow follow-up

- Archive the change with `openspec-archive` after merge and deploy.
