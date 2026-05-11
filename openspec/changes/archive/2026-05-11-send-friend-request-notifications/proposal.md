## Why

Friend requests currently surface only when the recipient happens to open the app. Senders never know a response landed. Without push or email pings, requests stall and the social graph stays cold. Issue #112.

## What Changes

- Add notification preferences to user profile: independent push and email channel toggles plus per-type opt-out. v1 ships a single type `friend_requests` covering both received and responded events. The per-type list is designed to extend (e.g. future `tour_invites`, `tour_updates`) without schema change.
- Add disclaimer in profile UI when both channels are off, warning user may miss incoming friend requests and other important updates.
- Add Web Push subscription flow: VAPID-based registration via service worker, multi-device support via new `push_subscriptions` table.
- Detect iOS Safari outside an installed PWA and show install guidance instead of a broken push toggle.
- Extend `services/email-hook` Cloudflare Worker with notification routes (`/notify/friend-request-received`, `/notify/friend-request-responded`). Worker verifies caller via Supabase JWT, loads recipient prefs + push subscriptions, dispatches Brevo email + Web Push as enabled.
- Friendships store calls Worker after a successful send/respond RPC, fire-and-forget.
- Response notification states only that the request was responded to — never accept vs decline (per issue).
- Add four Brevo templates: `friend_request_received_{en,de}`, `friend_request_responded_{en,de}`. Localized via `user_profile.locale`. Ship copy-ready HTML/text drafts in repo under `services/email-hook/brevo-templates/` for paste-in.
- Vet Web Push dependency for known CVEs before adding (npm audit + GitHub Advisory Database). Prefer libraries with active maintenance and no high/critical advisories.
- Document manual setup steps (VAPID generation, Brevo template creation, Worker secret population, Supabase migration, env vars) in a single `services/email-hook/SETUP-NOTIFICATIONS.md` checklist.
- Define manual smoke tests covering each channel and platform (Android Chrome push, desktop push, iOS-installed-PWA push, email per locale, all-off disclaimer).
- Add service worker `push` and `notificationclick` handlers; deep-link clicks to friend requests sheet.

## Capabilities

### New Capabilities
- `notifications`: Channel preferences, push subscription registration, dispatch trigger contract from client to Worker, Web Push delivery, email delivery, localization rules, iOS-PWA gating.

### Modified Capabilities
- `friendships`: After-action hook to dispatch notifications on request created and request responded.
- `user-profile`: Notification preference fields, profile UI section, disclaimer when all channels off.
- `auth-email-hook`: Worker extended with notification routes and JWT verification (renamed scope or kept; design decides).
- `pwa-support`: Service worker handles `push` and `notificationclick` events; subscription registration on app start when permission granted.

## Impact

- DB: new migration — `push_subscriptions` table + RLS; new columns on `user_profiles` for notification prefs (or `notification_preferences` JSONB).
- Worker: `services/email-hook/` gains routes, JWT verifier, web-push library, VAPID keys, four Brevo template IDs, Supabase service-role key.
- Frontend: new `notifications` feature module (DDD), service worker updates in `vite-plugin-pwa` config, Pinia store + composables, profile UI section, i18n keys (en, de-CH).
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`, four `BREVO_TEMPLATE_FRIEND_*` IDs.
- No breaking changes to existing auth email flow.
