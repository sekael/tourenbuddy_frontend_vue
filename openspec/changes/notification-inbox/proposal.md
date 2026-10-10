# Proposal

## Why

Notifications only exist as transient push/email (#300): a user with both channels off — the default — never learns a friend shared a tour, sent a request, or proposed a change. And they only fire if the actor's client remembers to call the Worker afterwards, so a crashed tab or a disabled `VITE_NOTIFICATIONS_ENABLED` deploy silently drops events. Separately (#148), push breaks across devices: the push toggle is account-wide while subscriptions are per-browser, and turning push off on one device deletes every device's subscription.

## What Changes

- **New in-app notification inbox**: an inbox entry in the speed-dial menu (no new map chrome), with a badge on both the entry and the speed-dial trigger. It opens an inbox sheet (bottom sheet on mobile, dialog on desktop) listing notifications newest first, 20 at a time with "Load more". Items render in the current locale and deep-link on tap (no inline actions). They can be marked read (single + all) and swiped away. Entries whose subject is resolved or gone render visibly **stale** (muted, with a reason chip) and do not count toward the badge. Repeated unread tour-edit/collision events collapse into one entry. Read state and deletes work offline. Entries older than 90 days are purged.
- **Inbox ignores preferences**: every event lands in the inbox regardless of push/email channel toggles AND muted types. Mutes and channels now only govern interruption (push/email).
- **BREAKING (internal contract)**: notification events are emitted **in the database**, in the same transaction as the write that caused them (RPCs + triggers), as rows in a new `notifications` table. That table is the single event log.
- **BREAKING (internal contract)**: push/email fan-out is driven by the event log — each inserted row triggers one async `pg_net` call to the Worker, which applies channel prefs + mutes and sends. The client→Worker fire-and-forget dispatch (`notify-dispatch.ts`, ~15 call sites) and the 7 per-event Worker endpoints are **removed**. Push/email stay best-effort (no retry); the inbox row is the record.
- **Multi-device push (#148)**: the push toggle reflects **this device's** subscription. Enabling registers only this browser; disabling removes only this browser's endpoint; other devices keep receiving. The Worker sends push iff the user has subscription rows. Sign-out removes this device's row. `notif_push_enabled` is deprecated (no longer read), dropped in a later change.
- Blocking a user removes inbox entries that user caused.
- **BREAKING (DB)**: clients lose direct `insert`/`update` on `tours` and all writes on `tour_partners`. Every create/edit goes through the existing emitting functions (audited: no current caller breaks; only PWA clients cached before 2026-08-06 would fail).
- **Behaviour fix**: the same-tour collision scan now runs on create and for tours without partners, as `tour-linking` already requires (today it only runs on edits of tours that have partners).
- Onboarding guided tour gains an inbox step.
- Scope v1: only events that exist today (friend requests, shared-tour created/updated/deleted, tour interest incl. collision scan, backfill digest, link requests, group joined/evicted/dissolved, suggestions). Availability and release-note entries are deferred.
- Delivered as a single PR (owner's decision, accepting review size).

## Capabilities

### New Capabilities
- `notification-inbox`: persistent per-user record of notification events, its in-app inbox surface (badge, list, read/unread, delete, deep links, offline), retention, and privacy rules (block removal).

### Modified Capabilities
- `notifications`: push registration becomes per-device; dispatch authorization moves from caller-JWT checks to a DB-originated authenticated webhook; channel prefs + mutes scoped to push/email only; push toggle semantics change.
- `shared-tour-notifications`: shared-tour, collision-scan, backfill, link-request and suggestion events are emitted by the database atomically with the write instead of by a client→Worker call; delivery to push/email is derived from the emitted event.
- `tour-linking`: collision-detected, group-membership and link-request notifications are emitted by the database instead of client-invoked Worker calls.
- `onboarding-tour`: guided step sequence gains the notification inbox step.

## Impact

- **DB** (new migrations only): `notifications` table + grants + RLS + realtime publication; `pg_net` + `pg_cron` extensions; Vault secrets for Worker URL + shared secret; emission helper; emission added to `create_tour_full`, `update_tour_full`, `friend_requests` insert/status triggers, `accept_friend_request` (backfill digest), link-request RPCs, suggestion RPCs, tour delete trigger, group eviction/dissolution triggers, block RPC; AFTER INSERT webhook trigger; 90-day purge cron.
- **Worker** (`services/email-hook`): new `/notify/event` endpoint (shared-secret auth) replacing 7 `/notify/*` endpoints; push copy/email selection keyed by event type+action; push gated on subscription rows, not `notif_push_enabled`. **Manual `npx wrangler@latest deploy` required** + new secret.
- **Frontend**: new inbox store/repository/components in `features/notifications`; inbox entry + badge in the speed-dial menu (`map-speed-dial-menu`, `speed-dial-trigger`), inbox as a new `activeOverlay` on the map page; `use-web-push` + notifications store per-device rework; sign-out hook; removal of `notify-dispatch.ts` and call sites in `tours-store`, `friendships-store`, `tour-links-store`, `tour-suggestions-store`; i18n keys (`en`, `de-CH`); new icons in `icons.ts`; onboarding steps.
- **Deploy order**: migration + Vault secrets → Worker deploy → frontend. Old cached PWA clients still calling removed endpoints get 404, harmless (fire-and-forget).
