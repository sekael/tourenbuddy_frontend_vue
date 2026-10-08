# Design

## Context

See proposal.md → Why. Current state that shapes the approach:

- **Dispatch today**: after a successful write, stores call `notify-dispatch.ts` (fire-and-forget `fetch` with the user's JWT) → one of 7 Worker `/notify/*` endpoints, which re-resolve recipients from live rows, verify the caller is the actor, check `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types`, and send. Offline writes fire through the DC6 success seam on replay. Gated client-side by `VITE_NOTIFICATIONS_ENABLED`.
- **Event semantics live in three places**: client TS (meaningful-edit filter `isMeaningfulTourChange`, newly-added partner diff, completion flip, group-event recipient snapshots + tour names), Worker TS (recipient resolution, group-membership matrix, copy), and SQL (collision predicate `fn_collision_predicate`, `fn_scan_collisions_for_tour`, `fn_scan_backfill_collisions`, eviction/dissolution triggers).
- **Write paths are already DB-centric**: tours via `create_tour_full` / `update_tour_full` (partners in the same call, completion included); friend requests via `send_friend_request` (insert) / `accept_friend_request` / direct `friend_requests` status update (deny); link requests + suggestions via RPCs; group eviction/dissolution via existing triggers; tour delete is a direct `delete from tours`.
- **Push (#148)**: `push_subscriptions` is unique on `endpoint` with a `user_id` index and the Worker fans out to all rows — multi-device already works server-side. The client breaks it: the toggle reads account-wide `notif_push_enabled`, `ensureSubscription` only refreshes an existing browser subscription, and `unsubscribe()` calls `removeAllForUser`. A second device sees "on" with no row; flipping off/on wipes the first device. Plus RLS blocks a second account from upserting an endpoint owned by the first.
- **Discovered drift**: the collision scan is only invoked on *update* of a tour that has partners (`isShareableTour` gate) — never on create, never for solo friends-visible tours — contradicting `tour-linking` "Tour save fires collision-detected notification". This change fixes it (spec deltas), which will increase `tour_interest` volume.
- UI chrome: the map page has no top bar; navigation lives in the speed-dial menu, and sheets share one `activeOverlay` slot in `map-page.vue`.
- RLS currently allows direct client `insert`/`update` on `tours` and all writes on `tour_partners`, which would bypass emission (closed in D8).
- Constraints: CF Workers free plan (50 subrequests/invocation, 100k req/day); `pg_net` and `pg_cron` not yet enabled; all DB changes via new migrations.

## Goals / Non-Goals

**Goals:**
- One brain: the database decides *who gets notified about what*, atomically with the write. The Worker only decides *how* (channels, mutes, locale, copy).
- No client involvement in emitting or dispatching notifications.
- Push works on N devices with per-device control.

**Non-Goals:**
- Guaranteed push/email delivery (no retry/outbox; inbox is the record).
- Availability and release-note entries (deferred; the `type` column accepts them later without schema change).
- Grouping/collapsing similar entries, undo for delete, per-entry snooze.
- Dropping `notif_push_enabled` (later migration once old PWA clients have updated).

## Decisions

### D1 — `notifications` table is the event log

```
notifications(
  id uuid pk default gen_random_uuid(),
  recipient_id uuid not null references auth.users on delete cascade,
  type text not null,            -- notification type (friend_requests | tour_updates | tour_interest | tour_suggestions)
  action text not null,          -- received | responded | created | updated | deleted | collision | backfill | link_created | link_declined | group_joined | group_evicted_external | group_dissolved | suggestion_submitted | suggestion_resolved (no link_accepted: group_joined covers it, as the client did)
  actor_id uuid null,            -- no FK: survives actor account deletion
  actor_name text null,          -- snapshot at event time (owner decision)
  tour_id uuid null,             -- no FK: survives tour deletion; client checks existence on open
  tour_name text null,           -- snapshot at event time
  ref jsonb not null default '{}', -- friendship_id, group_id, batch_id, request_id, collision_count …
  occurrences int not null default 1, -- collapsed repeats (D2)
  read_at timestamptz null,
  created_at timestamptz not null default now()
)
index (recipient_id, created_at desc)
index (recipient_id) where read_at is null   -- unread query (D7)
```

- `type` reuses the mute-type vocabulary so the Worker's mute check is `muted_types @> array[type]`, no mapping table.
- `text` + no enum for `action`, matching the spec's "extensible without schema change" stance for types.
- Grants: `select, delete, update (read_at)` to `authenticated`; `all` to `service_role`; **no insert** for `anon`/`authenticated` (spec: users cannot forge entries). This deviates from the conventions' `grant all` template deliberately — the template exists to restore Data API exposure, which `select` already does. RLS: `recipient_id = auth.uid()` for select/update/delete.
- Added to the `supabase_realtime` publication.
- **Alternative**: rendered title/body columns — rejected (owner decision; locale switch must re-render).
- **Alternative**: live-resolving actor names — rejected by owner in favour of snapshots; consequence: renamed users show the old name on old entries, ex-friends stay named. Block removes entries (D8) to cover the privacy case.

### D2 — Single emission helper

`fn_emit_notification(p_recipients uuid[], p_type text, p_action text, p_tour_id uuid, p_tour_name text, p_ref jsonb)` — `security definer`, `search_path = ''`:

1. `actor := auth.uid()`; drops `actor` and nulls from recipients (spec: actor never notified — one place instead of every call site).
2. Snapshots `actor_name` from `user_profile`.
3. Inserts one row per distinct recipient. **Collapse** (only for `tour_updates/updated` and `tour_interest/collision`): if the recipient has an unread row with the same `(type, action, tour_id, actor_id)`, it runs `update … set occurrences = occurrences + 1, created_at = now(), tour_name = <new snapshot>` instead. That is an UPDATE, so the insert-only dispatch trigger (D4) sends no push. Read entries never collapse, which keeps history honest.
4. Whole body inside `begin … exception when others then raise warning …; end` → the user's write never aborts because of notifications (spec: "Event recording never fails the originating write").

Why a helper instead of inline inserts: actor exclusion, snapshotting and the exception guard are the three things that must never be forgotten, and there are ~12 emission sites.

**Alternative for collapse:** collapse on the client at render time. Rejected because it doesn't reduce push noise.

Not granted to `authenticated` (`revoke execute … from public, anon, authenticated`) — only callable from other definer functions/triggers, so a client can't emit.

### D3 — Emit where the semantic event is visible, not uniformly in row triggers

| Event | Emission site | Why there |
|---|---|---|
| friend request received | AFTER INSERT trigger on `friend_requests` | row = event |
| friend request responded | AFTER UPDATE trigger on `friend_requests` when status leaves `pending` for `accepted`/`denied` | covers both RPC accept and direct-update deny; outcome not disclosed (existing spec) |
| backfill digest | `accept_friend_request` after the friendship row exists | needs both users + `fn_scan_backfill_collisions` |
| tour created / updated / newly-added partner / collision scan | `create_tour_full`, `update_tour_full` | only place that sees old row, new row, old + new partner sets in one call; row triggers on `tours` can't see the partner diff (partners are separate `tour_partners` rows) |
| tour deleted | BEFORE DELETE trigger on `tours`, only when `auth.uid() = old.user_id` | row still readable → partner user ids + name; skips account-deletion cascades (no `auth.uid()`) |
| link request created / accepted / declined | `create_link_request`, `accept_link_request`, `decline_link_request` | RPCs already enforce actor; withdraw emits nothing |
| group joined | `accept_link_request` | knows pre-existing members |
| group evicted / dissolved | `fn_evict_member_on_tour_change`, `fn_evict_on_friendship_delete`, tour BEFORE DELETE trigger, via `fn_emit_group_removal` called BEFORE the member rows go | a row trigger on `tour_link_member` would double-count: `fn_dissolve_when_below_two` cascades the last member away mid-statement and an unfriend removes two rows at once; the Worker matrix moves here verbatim |
| suggestion submitted | `upsert_tour_suggestions` when a *new* batch is created (not on revision) | batch = one call |
| suggestion resolved | `accept_tour_suggestion(_batch)`, `decline_tour_suggestion` via `fn_resolved_batches` | completion check already exists; auto-declines run through the same path |
| accepted suggestion → `tour_updates` | `accept_tour_suggestion(_batch)` when an applied field is meaningful, excluding authors (D16) | once per call |

**Alternative — pure row triggers everywhere** (owner's initial lean): rejected for tour updates and suggestions because the events are multi-row (partner diff, batch-once) and per-row triggers would emit N times or need transaction-local state hacks (`set_config` carrying partner diffs). RPC emission is still in-DB and atomic, which is what the requirement ("must not depend on a worker / client") actually needs.

**Meaningful-edit filter** moves to SQL as `fn_is_meaningful_tour_change(old public.tours, new public.tours, partners_changed bool)`. The TS `isMeaningfulTourChange` / `isMeaningfulSuggestionField` are deleted once unused (Worker never had them). Recipients: `tour_partner_user_ids(tour_id)` ∩ owner's friends, as the Worker does today.

**Offline**: replayed writes go through the same RPCs, so they emit exactly once on commit; the DC6 notification half of the success seam is deleted (eviction half for UI stays if still needed for local state).

### D4 — Fan-out: AFTER INSERT on `notifications` → `pg_net` → Worker `/notify/event`

- Trigger `fn_dispatch_notification()` (definer) — **AFTER INSERT only**, so collapsed updates never push; reads `notify_hook_url` + `notify_webhook_secret` from `vault.decrypted_secrets`; if either is missing it returns silently (local without Worker, CI, preview DBs) — inbox still works.
- Calls `net.http_post(url || '/notify/event', body := to_jsonb(new), headers := {'x-notify-secret': secret})`. `pg_net` queues the request and sends it **after commit** from a background worker, so rolled-back writes never push and the user's transaction never waits on HTTP.
- Body = the full row (not just id) to save one Worker subrequest on the free plan; the secret makes the body trustworthy.
- At-most-once, no retry (owner decision). Failures visible in `net._http_response` (kept ~6 h by pg_net) and Worker logs.
- **Alternative — Supabase Database Webhooks UI**: same mechanism but configured in the dashboard → violates migrations-only rule. **Alternative — Realtime listener in Worker**: Workers can't hold long-lived sockets on free plan.

### D5 — Worker becomes a pure channel router

- New `handleEvent(request, env)`: constant-time compare of `x-notify-secret` with `NOTIFY_WEBHOOK_SECRET`; parse row (zod-free, shape check); fetch recipient profile (email flag, mutes, locale); if type muted → done; push via existing `dispatchPushToUser` (no `notif_push_enabled` check — zero rows = no push); email via existing Brevo path when `notif_email_enabled`.
- Copy: existing `pushTitleFor` / `tourPushTitle` / `tourPushBody` / digest copy re-keyed on `(type, action)`; push `url` gains `notification=<id>` so the app marks the entry read on open.
- Deleted: the 7 `/notify/*` handlers, their JWT/actor checks, recipient resolution helpers no longer used. `auth.ts` stays for calendar endpoints.
- New secret `NOTIFY_WEBHOOK_SECRET` (`wrangler secret put`), same value in Vault.

### D6 — Per-device push

- Toggle state = `Notification.permission === 'granted'` **and** `pushManager.getSubscription()` non-null. On load with a live subscription, `ensureSubscription` re-registers the row (heals a row deleted server-side, e.g. 410 cleanup).
- Registration via new definer RPC `register_push_subscription(p_endpoint, p_p256dh, p_auth, p_user_agent)`: `insert … on conflict (endpoint) do update set user_id = auth.uid(), …` — reassigns an endpoint left behind by another account on a shared browser (RLS would otherwise reject the upsert).
- Disable → `removeSubscription(endpoint)` (already exists) + `subscription.unsubscribe()`. `removeAllForUser` deleted.
- Sign-out → same as disable, **before** `supabase.auth.signOut()` (needs the JWT for the RLS delete); best-effort, never blocks sign-out.
- Toggle is disabled while offline (PushManager subscribe needs network); the `notif-prefs` queue entry stops carrying push state. Existing queued entries still replay (extra field ignored).
- `notif_push_enabled` no longer read/written by client or Worker. Migration deletes `push_subscriptions` rows of users with `notif_push_enabled = false` (shouldn't exist, defensive) so the "rows = enabled" invariant holds from day one.
- **Alternative — keep account flag + only fix `removeAllForUser`**: leaves the misleading "on" toggle on new devices (owner rejected).

### D7 — Client inbox

- `features/notifications`: `domain/entities/inbox-notification.ts`, `domain/repositories/inbox-repository.ts`, `data/models/inbox-schemas.ts` (Zod), `data/repositories/inbox-repository-impl.ts`, `presentation/stores/inbox-store.ts`, components `inbox-badge.vue` (shared by menu item + trigger), `inbox-overlay.vue`, `inbox-item.vue`, and `presentation/inbox-text.ts` mapping `(type, action)` → i18n key + params (`actor`, `tour`, `count`).
- Store: initial load = two indexed queries merged by id: newest 20 (list page) **and** all unread (`read_at is null`, limit 99 = badge cap). `loadMore()` keyset-pages on `created_at < last` by 20; `hasMore` = page came back full. `cachedLoad('inbox:<uid>')` caches the merged set. `useRealtimeSubscription` on `notifications` filtered `recipient_id=eq.<uid>`, `onChange` + `onSubscribed` → refetch (architecture rule). `isStale(entry)` computed from stores the app already loads (pending friend requests, pending suggestion batches, pending link requests, visible tours); `attentionCount` = unread ∧ ¬stale over the unread set (exact up to 99, the `9+` cap anyway).
- Writes through `mutate()`: `inbox-read` (entity = notification id), `inbox-delete` (entity = id; coalesces with a pending read), `inbox-read-all` (entity = `inbox-all:<uid>`, payload = cutoff `created_at`, replay = `update … set read_at = now() where recipient_id = uid and read_at is null and created_at <= cutoff` so entries arriving later stay unread). No LWW gate — `read_at` is monotonic and deletes are idempotent.
- Deep links: existing `?tours=1` / `?friendRequests=1` query handling extended with `tour=<id>` (open info sheet) and `notification=<id>` (mark read, then strip param). Missing tour → snackbar `inbox.unavailable`.
- Swipe: pointer events + CSS transform on `inbox-item`, threshold 40 % width, `touch-action: pan-y` so vertical scroll still works; pointer devices get a hover/focus delete icon button. No gesture library (ponytail: add one if more swipe surfaces appear).
- Entry point (owner decision: no new map chrome): an "Inbox" item in `map-speed-dial-menu` with a count badge, and the same count mirrored on `speed-dial-trigger`, capped at `9+`. Icon `notifications` added to `icons.ts`. *Correction from the first draft:* the map page has no top bar, and `side-drawer.vue` is a desktop panel, not navigation.
- Overlay: a new `activeOverlay === 'inbox'` branch in `map-page.vue`'s `sheet-host` switch, like `friend-requests`. It's a bottom sheet on mobile and a dialog on desktop through the same components (fits content per the dialog rule). It replaces any open sheet, which matches the one-sheet-at-a-time model.
- No inline actions: entries are static records, and acting happens on the deep-linked surface.
- Visual states (existing tokens only):

  | State | Background | Text | Icon | Marker |
  |---|---|---|---|---|
  | Unread, live | `--color-surface-variant` | `--color-on-surface`, 600 | `--color-primary` | `--color-primary` dot |
  | Read, live | `--color-background` | `--color-on-surface`, 400 | `--color-on-surface-variant` | none |
  | Stale | `--color-background` | `--color-on-surface-variant` | `--color-outline` | outlined chip (`--color-outline-variant`, `history` icon): Answered / No longer pending / Tour deleted |

  The `history` icon is registered in `icons.ts`. `aria-label` appends the state reason.

### D8 — Close direct write paths

- `revoke insert, update on public.tours from anon, authenticated`; `revoke insert, update, delete on public.tour_partners from anon, authenticated`; drop the now-dead RLS policies `tours_insert_own`, `tours_update_own`, `tour_partners_insert_own`, `tour_partners_update_own`, `tour_partners_delete_own`. `tours` delete stays (the BEFORE DELETE trigger emits).
- Audit (grill Q6): the only SQL writers are `create_tour_full`, `update_tour_full`, `fn_apply_tour_suggestion`, all `security definer`. Old overloads are dropped. The client only deletes and reads `tours`. The Worker only reads, with the service role. pgTAP writes run after `reset role` and the seed runs as `postgres`. FK cascades run as the owner. Only PWA clients cached before 2026-08-06 would break.
- Why: it turns "always go through the emitting RPCs" from a convention into a constraint.

### D9 — Block + retention

- `block_user` additionally `delete from notifications where recipient_id = auth.uid() and actor_id = target`.
- `pg_cron` daily job `delete from public.notifications where created_at < now() - interval '90 days'`. Not the Worker cron: inbox must not depend on the Worker.

## Risks / Trade-offs

- [Two-brain risk removed, but one big PR] → tasks grouped so each group is reviewable on its own commit; owner accepted single PR.
- [Pushes lost when Worker unreachable / misconfigured] → inbox still records; `net._http_response` + Worker logs; follow-up issue for a `dispatched_at` + pg_cron retry if it hurts.
- [Deploy window: migration live before Worker deploy → webhook 404s] → deploy Worker immediately after `supabase db push`; lost pushes limited to that window, inbox unaffected. Reverse order is worse (old endpoints gone while old clients still post — harmless 404s but no DB emission yet → no push at all).
- [Old cached PWA clients still post to removed endpoints] → 404, fire-and-forget, no double send since DB is the only emitter.
- [Behaviour change: collision scan now on create + solo tours] → more `tour_interest` pings; matches spec; called out in PR.
- [Semantic port bugs (meaningful filter, group matrix) when moving TS → SQL] → pgTAP tests per emission site for edge cases (actor excluded, non-meaningful edit silent, partner removal silent, revision silent, withdraw silent, cascade dissolution).
- [Exception guard hides bugs] → `raise warning` lands in Postgres logs; pgTAP asserts rows are actually emitted.
- [Badge ceiling] → the unread query is capped at 99; the display caps at `9+`, so this is invisible.
- [Collapsed repeats send no push] → intended (grill Q2); the user still sees the bumped entry and its count.
- [Revoked writes break very old cached clients] → only pre-2026-08-06 bundles; mentioned in the PR.
- [Realtime DELETE events can't be filtered by `recipient_id`] → deletes from another device appear on next refetch (visibility return / `onSubscribed`), inserts + read updates are live. Acceptable.
- [Write latency: collision scan inside `create/update_tour_full`] → same query the Worker ran, now without HTTP; GiST index on `goal` already used by predicate.
- [Snapshotted names: stale after rename, persist after unfriend] → owner decision; block deletes them.
- [CF free plan] → one invocation per entry, ≤ ~5 subrequests + 1 per device; well within limits.

## Migration Plan

1. Migrations (local first, `supabase db reset`, `supabase test db`): extensions `pg_net`, `pg_cron`; `notifications` table/grants/RLS/publication; helper + emission sites; dispatch trigger; `register_push_subscription`; push row cleanup; block + cron.
2. Local Vault secrets via `[db.vault]` in `supabase/config.toml` with `env(...)` values (`NOTIFY_HOOK_URL=http://host.docker.internal:8787`, dev secret).
3. Prod: `supabase db push` (prompt owner) → set Vault secrets once via `select vault.create_secret(...)` (data, not schema) → `wrangler secret put NOTIFY_WEBHOOK_SECRET` → `npx wrangler@latest deploy` → merge frontend.
4. Rollback: new migration dropping the dispatch trigger (inbox keeps working, pushes stop) + redeploy previous Worker and frontend tag. No data migration to undo.
5. Follow-up: drop `notif_push_enabled` column; remove `VITE_NOTIFICATIONS_ENABLED` / `VITE_NOTIFY_HOOK_URL` if no longer used by the client.
