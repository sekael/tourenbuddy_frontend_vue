# Tasks

## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/300-notification-inbox` (container: `git fetch` fails without ssh → branch from local `main`); verify `git branch --show-current` prints `feat/300-notification-inbox`

## 2. Inbox table + emission helper (DB)

- [x] 2.1 `supabase migration new notification_inbox`: enable `pg_net` + `pg_cron`; create `public.notifications` per design D1 with index, RLS (select/update/delete own), grants (`select, delete, update(read_at)` to authenticated; all to service_role; no insert for anon/authenticated), add to `supabase_realtime` publication; verify `supabase db reset` passes
- [x] 2.2 Add `fn_emit_notification` (D2: definer, actor exclusion, name snapshot, collapse for `tour_updates/updated` + `tour_interest/collision`, exception guard, execute revoked from clients); verify pgTAP `supabase/tests/notifications_rls.sql` covers: forged client insert rejected, foreign rows invisible, update of non-`read_at` column rejected, actor never in recipients, helper error does not abort caller, unread same-key repeat increments `occurrences` instead of inserting, read entry or different actor inserts a new row
- [x] 2.4 Revoke direct writes + drop dead policies per D8; verify pgTAP: authenticated direct `insert`/`update` on `tours` and any write on `tour_partners` rejected, `create_tour_full` / `update_tour_full` / tour delete still succeed as authenticated, existing `supabase test db` suites stay green
- [x] 2.3 Add daily `pg_cron` 90-day purge (D8); verify pgTAP asserts the job exists and its statement deletes only rows older than 90 days

## 3. Event emission in DB (port semantics from client + Worker)

- [x] 3.1 `friend_requests` insert/status triggers → `received` / `responded` (accepted + denied, outcome not disclosed); verify pgTAP: cancel emits nothing, deny emits `responded`
- [x] 3.2 `fn_is_meaningful_tour_change` + emission in `create_tour_full` / `update_tour_full` (created, updated, newly-added → created, removed partner silent, going private silent, completion flip notifies without scan); verify pgTAP for each silent case and the newly-added split
- [x] 3.3 Collision scan in tour RPCs on create + meaningful update of friends-visible tours incl. solo tours (behaviour fix); verify pgTAP: solo friends-visible create notifies colliding friend, completion-only update does not scan
- [x] 3.4 BEFORE DELETE trigger on `tours` → `deleted` to friend partners with name snapshot, only when `auth.uid() = owner`; verify pgTAP: service-role/cascade delete emits nothing
- [x] 3.5 Backfill digest in `accept_friend_request` (one per side, excluded pairs, count in `ref`); verify pgTAP: zero eligible collisions → no digest, already-linked pair excluded
- [x] 3.6 Link-request events in `create_link_request` / `accept_link_request` / `decline_link_request` + group `joined` in accept; verify pgTAP: withdraw emits nothing, joiner not notified
- [x] 3.7 Group `group_evicted_external` / `group_dissolved` at the eviction sites (computed before the member rows are deleted) (Worker matrix verbatim, tour names from OLD rows); verify pgTAP: self-eviction notifies only remaining members, friendship-delete cascade notifies each member once
- [x] 3.8 Suggestion events in `upsert_tour_suggestions` (new batch only) and accept/decline paths (fully-resolved only; accepted meaningful field → `tour_updates` to partners minus authors, once per call); verify pgTAP: revision silent, partial resolution silent, withdraw + predicate-break void silent
- [x] 3.9 `block_user` deletes blocker's entries whose actor is the target; verify pgTAP

## 4. Fan-out: pg_net webhook + Worker `/notify/event`

- [x] 4.1 Dispatch trigger on `notifications` insert reading Vault `notify_hook_url` / `notify_webhook_secret`, no-op when missing (D4); add local `[db.vault]` entries in `supabase/config.toml` via `env(...)`; verify `supabase db reset` passes without the env set and a local insert produces a `net._http_response` row when set
- [x] 4.2 Worker `handleEvent` with constant-time secret check, mute + email checks, push without `notif_push_enabled`, copy keyed by `(type, action)`, push url carries `notification=<id>`; wire `/notify/event` in `index.ts`; verify Worker unit tests (if present) or `npx wrangler dev` + curl: wrong secret → 401, muted type → no send
- [x] 4.3 Delete the 7 old `/notify/*` handlers + unused helpers; update `services/email-hook/SETUP-NOTIFICATIONS.md` (new secret, Vault setup, deploy order); verify `npx tsc --noEmit` in `services/email-hook` passes and grep finds no removed route

## 5. Multi-device push (#148)

- [x] 5.1 Migration: `register_push_subscription` definer RPC (reassign endpoint on conflict) + delete rows of users with `notif_push_enabled = false`; verify pgTAP: second user registering a foreign endpoint takes it over
- [x] 5.2 `use-web-push` + repository: register via RPC, disable removes only this endpoint, delete `removeAllForUser`; toggle state from permission + live subscription; toggle disabled offline; drop `notifPushEnabled` from prefs entity/store/queue; verify unit tests: disable on device B leaves other rows (repo mock asserts endpoint-scoped delete), new device shows off
- [x] 5.3 Sign-out removes this device's row + unsubscribes before `auth.signOut()`, best-effort; verify unit test: failing removal does not block sign-out
- [x] 5.4 Preferences copy: disclaimer → inbox hint; mute section states push/email only (`en`, `de-CH`); verify component test for hint visibility with push off on device + email off

## 6. Remove client dispatch

- [x] 6.1 Delete `notify-dispatch.ts` and calls in `tours-store`, `friendships-store`, `tour-links-store`, `tour-suggestions-store` (keep any eviction logic still needed for local UI state); delete `isMeaningfulTourChange` / `isMeaningfulSuggestionField` if unused; verify `npm run type-check` + `npm run test` pass and `grep -r notify-dispatch src` is empty

## 7. Inbox client

- [x] 7.1 Domain entity, repository interface, Zod schema, Supabase impl (page of 20 by keyset `created_at`, all unread ≤ 99, mark read, mark all ≤ cutoff, delete); verify schema test rejects unknown/malformed rows
- [x] 7.2 `inbox-store`: merged initial load (newest 20 ∪ unread), `loadMore` / `hasMore`, `cachedLoad`, realtime on `notifications` filtered by `recipient_id`, `isStale` from friend-request / suggestion / link-request / tour stores, `attentionCount` (unread ∧ ¬stale), `mutate` kinds `inbox-read` / `inbox-delete` / `inbox-read-all` + replay handlers; verify unit tests: 30 unread with only 20 listed still counts 30, stale unread entry excluded from count, last page short → `hasMore` false, offline read-all keeps later-arriving entries unread, delete coalesces a pending read, replay of already-deleted entry is idempotent
- [x] 7.3 `inbox-text.ts` `(type, action)` → i18n key + params for every action in D1, keys in `en.json` + `de-CH.json`; verify unit test that every action resolves to an existing key in both locales
- [x] 7.4 Inbox entry in `map-speed-dial-menu` + mirrored badge on `speed-dial-trigger` (`9+`, hidden at 0); `inbox` branch in `map-page.vue` overlay switch; `notifications` + `history` icons in `icons.ts`; verify component test for 0 / 3 / 12 attention count on both trigger and menu item
- [x] 7.5 `inbox-overlay.vue` + `inbox-item.vue` (empty state, unread / read / stale states per D7 token table with reason chip + aria-label, "Load more", collapsed `occurrences` shown, no inline actions, relative time, mark-all disabled at 0, swipe threshold + snap-back, pointer delete button, adaptive-overlay fit-content); verify component tests: partial swipe does not delete, mark-all disabled with no unread, stale overrides unread (no dot, chip shown), "Load more" hidden at end of history
- [x] 7.6 Deep links: `tour=<id>`, `notification=<id>` handling (mark read, strip param), missing tour → `inbox.unavailable` snackbar; verify unit test for missing-tour path
- [x] 7.7 Onboarding: add inbox menu-entry step after offline maps, menu kept open between them, per `onboarding-tour` delta; verify onboarding steps test + walk the guided tour end-to-end in the app

## 7a. First-test follow-ups

- [x] 7a.1 Suggestion revisions notify the owner as `suggestion_revised` (new migration `20261009050133_notification_suggestion_revised.sql`; client text, stale check, Worker push copy, DB test 11s-a)
- [x] 7a.2 Inbox rows drop the leading type icon (read as a button); swipe reveals a delete layer; pointer delete uses `BaseIconButton`
- [x] 7a.3 "Mark all read" is a labelled button, shown only while something is unread
- [x] 7a.4 Speed-dial trigger mirrors the inbox count only (friend requests are inbox entries — no double count); Contacts shows a dot for pending requests
- [x] 7a.6 Entries open a tour only if it's own or a current partner tour, checked after a fresh friend-tour refetch; collision opens the recipient's own tour; stale chip uses the same rule ("No longer available")
- [x] 7a.7 Losing access deletes the user's entries for that tour (partner removed, private, deleted, unfriended); re-share notifies as `created` — migration `20261010065119_notification_visibility_cleanup.sql`, DB tests 12v / 12a-2 / 17
- [x] 7a.8 "Clear inbox" with inline confirm; offline-queued `removeAll(cutoff)`
- [x] 7a.9 Seasons and start/end point (location, name) count as meaningful edits, also for accepted suggestions — migration `20261010070418_notification_meaningful_points_seasons.sql`, DB tests 8d-a..c
- [ ] 7a.5 Deploy: `supabase db push` (new migrations) and `cd services/email-hook && npx wrangler@latest deploy` (push copy)

## 8. Integration verification

- [ ] 8.1 Local end-to-end with `supabase start` + `wrangler dev`: two browsers/accounts — friend request, shared-tour edit, suggestion batch each create exactly one inbox entry and one push on each of two registered devices; push off on device 1 keeps device 2 receiving; muted type → inbox only
- [ ] 8.2 `npm run test`, `npm run type-check`, `supabase test db` all pass

## 9. Finalize

- [x] 9.1 Run `npx eslint src test --fix` (not `.`, sweeps worktrees) and verify zero warnings; never `npm run format`
- [ ] 9.2 Prompt owner to commit with a ready-to-copy message, e.g. `feat(notifications): add in-app notification inbox with db-emitted events and per-device push` (body: closes #300, closes #148, behaviour fix: collision scan on create/solo tours)
- [ ] 9.3 Prompt owner to push and open a PR to `main`, listing deploy order: `supabase db push` → Vault secrets → `wrangler secret put NOTIFY_WEBHOOK_SECRET` → `npx wrangler@latest deploy` → merge

## Workflow follow-up

- Archive the change with `openspec-archive` after merge and deploy.
- File follow-ups: drop `notif_push_enabled`; availability + release-note inbox entries; optional `dispatched_at` retry if lost pushes matter.
