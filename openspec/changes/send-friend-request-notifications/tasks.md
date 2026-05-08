## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/112-friend-request-notifications`

## 2. Database

- [x] 2.1 New migration `supabase/migrations/<date>_notifications.sql`: add `notif_push_enabled`, `notif_email_enabled`, `notif_muted_types` to `user_profiles` with defaults
- [x] 2.2 Same migration: create `push_subscriptions(id, user_id, endpoint unique, p256dh, auth, user_agent, created_at, last_seen_at)` + index on `user_id`
- [x] 2.3 RLS on `push_subscriptions`: select/insert/delete where `user_id = auth.uid()`
- [x] 2.4 Apply migration locally and update `supabase_definitions.sql`

## 3. Worker — services/email-hook

- [x] 3.1 Vet candidate Web Push libraries: run `npm audit`, check GitHub Advisory DB + socket.dev for `@block65/webcrypto-web-push` (preferred) and `@negrel/webpush` (fallback). Document chosen lib + audit result in `services/email-hook/SETUP-NOTIFICATIONS.md`. Reject any package with unpatched high/critical CVE or stale repo (>12mo no commit + open security issues). Add chosen lib + Supabase service-role client to deps
- [x] 3.2 Add Supabase JWT verifier middleware (`Authorization: Bearer …` → user id)
- [x] 3.3 Add config schema: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `BREVO_TEMPLATE_FRIEND_RECEIVED_EN/DE`, `BREVO_TEMPLATE_FRIEND_RESPONDED_EN/DE`
- [x] 3.4 Implement `POST /notify/friend-request-received`: load friendship, authorize caller is sender, fetch recipient profile + subscriptions, dispatch email + push per prefs
- [x] 3.5 Implement `POST /notify/friend-request-responded`: same shape, authorize caller is recipient, dispatch to sender, body must not state outcome
- [x] 3.6 Implement push dispatcher: serialize `{ title, body, url }`, sign with VAPID, on 404/410 delete subscription row
- [x] 3.7 Email dispatcher: pick locale-matching template id, params `{ actorName, appUrl }`
- [x] 3.8 Update `services/email-hook/README.md` with new routes, secrets, and Brevo template names + params
- [x] 3.9 Tests: route auth (401/403), pref filtering, locale fallback, stale endpoint cleanup, no-outcome body for responded route

## 4. Frontend — notifications feature

- [x] 4.1 Create `src/features/notifications/{data,domain,presentation}` skeleton per DDD
- [x] 4.2 Domain entity `NotificationPreferences` and `NotificationType` union — v1 union value: `'friend_requests'`. Comment in code marks union as the extension point for future tour notification types
- [x] 4.3 Domain repo interface `PushSubscriptionRepository` (add/remove/listForUser) and `NotificationPreferencesRepository`
- [x] 4.4 Data: Zod schemas + Supabase impls for both repos
- [x] 4.5 Pinia store `useNotificationsStore` with prefs state, push permission state, register/unregister actions
- [x] 4.6 Composable `useWebPush` wrapping `navigator.serviceWorker` + `pushManager`, VAPID key from `env.VITE_VAPID_PUBLIC_KEY`
- [x] 4.7 Composable `useNotificationCapability`: detects iOS-non-standalone, returns `{ pushSupported, requiresPwaInstall }`
- [x] 4.8 Worker dispatch client `notifyFriendRequestReceived(friendshipId)` and `notifyFriendRequestResponded(friendshipId)` — POST with Supabase access token, fire-and-forget, log on failure

## 5. Profile UI

- [x] 5.1 Add notifications section to user profile sheet/page: push toggle, email toggle, per-type mute switch (v1 shows just `friend_requests`). Render per-type switches by iterating the `NotificationType` union so future types appear automatically
- [x] 5.2 Show install-PWA hint when `requiresPwaInstall` is true; hide push toggle in that case
- [x] 5.3 Show all-channels-off disclaimer block when `notif_push_enabled === false && notif_email_enabled === false`
- [x] 5.4 i18n: add keys under `notifications.*` to `en.json` and `de-CH.json` (titles, bodies, toggle labels, disclaimer, install hint, denied hint)

## 6. Friendships integration

- [x] 6.1 In `friendships-store`, after successful insert call `notifyFriendRequestReceived(friendshipId)`
- [x] 6.2 After successful accept/decline update call `notifyFriendRequestResponded(friendshipId)`
- [x] 6.3 Tests: dispatch is called on success, not called on RPC failure

## 7. PWA / Service Worker

- [x] 7.1 Switch `vite-plugin-pwa` to `injectManifest` strategy if needed and add `src/sw.ts` with Workbox precache + custom listeners
- [x] 7.2 Implement `push` listener: parse JSON, `registration.showNotification`
- [x] 7.3 Implement `notificationclick`: focus existing client or `clients.openWindow(data.url)`; data.url should open the friend requests sheet (`/?friendRequests=1`)
- [x] 7.4 On app start, if push permission granted and notifications store has push enabled, ensure subscription is registered and row up-to-date

## 8. Brevo templates (in-repo drafts)

- [x] 8.1 Create folder `services/email-hook/brevo-templates/`
- [x] 8.2 Add `friend_request_received_en.html` + `.txt` (subject hint at top comment, body uses `{{ params.actorName }}` and CTA link `{{ params.appUrl }}`)
- [x] 8.3 Add `friend_request_received_de.html` + `.txt` (German copy)
- [x] 8.4 Add `friend_request_responded_en.html` + `.txt` (no accept/decline outcome in body)
- [x] 8.5 Add `friend_request_responded_de.html` + `.txt`
- [x] 8.6 Operator pastes each into Brevo as a transactional template, captures the numeric `templateId`, sets the matching Worker secret. Steps documented in `SETUP-NOTIFICATIONS.md`

## 9. Manual setup documentation

- [x] 9.1 Create `services/email-hook/SETUP-NOTIFICATIONS.md` — single ordered checklist for operators:
  1. Generate VAPID keypair (`npx web-push generate-vapid-keys`); paste public+private into Worker secrets
  2. Create the four Brevo templates by pasting `brevo-templates/*.html|.txt`; capture numeric IDs
  3. `wrangler secret put` for: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `BREVO_TEMPLATE_FRIEND_RECEIVED_EN`, `BREVO_TEMPLATE_FRIEND_RECEIVED_DE`, `BREVO_TEMPLATE_FRIEND_RESPONDED_EN`, `BREVO_TEMPLATE_FRIEND_RESPONDED_DE`
  4. Apply Supabase migration (`supabase db push`)
  5. Set frontend env vars `VITE_VAPID_PUBLIC_KEY`, `VITE_NOTIFY_HOOK_URL` in Cloudflare Pages + `.env.local`
  6. `wrangler deploy`
  7. Rollback procedure (flip `VITE_NOTIFICATIONS_ENABLED=false`, redeploy frontend)
- [x] 9.2 Add `VITE_VAPID_PUBLIC_KEY`, `VITE_NOTIFY_HOOK_URL`, `VITE_NOTIFICATIONS_ENABLED` to `core/constants/env.ts` Zod schema and `.env.example`
- [x] 9.3 Link `SETUP-NOTIFICATIONS.md` from project root `README.md` and from `services/email-hook/README.md`

## 10. Tests

- [x] 10.1 Unit tests for repos (mock interfaces), notifications store, useWebPush composable error paths
- [x] 10.2 Component test: profile notifications section toggles, disclaimer visibility, iOS-non-standalone state
- [x] 10.3 Friendships store tests: dispatch called/not-called paths, dispatch failure does not break RPC result
- [x] 10.4 Worker tests as in 3.9
- [x] 10.5 Run `npm audit --omit=dev` in repo root and `services/email-hook/` — record output, fail task if high/critical present

## 11. Manual smoke tests (run after deploy of preview env)

Document results in PR description checklist.

- [ ] 11.1 Android Chrome: install PWA, enable push, send self friend request from second account → push received within 10s, click opens friend requests sheet
- [ ] 11.2 Desktop Chrome (Linux/macOS/Windows): grant push permission → friend request push received, click focuses existing tab
- [ ] 11.3 iOS Safari, NOT installed: open prefs → push toggle hidden, install hint visible
- [ ] 11.4 iOS 16.4+ installed PWA: enable push → push received on lock screen
- [ ] 11.5 Email path EN: user with `locale=en`, push disabled, email enabled → receives English email referencing actor name on both received and responded events
- [ ] 11.6 Email path DE: same with `locale=de` and German template
- [ ] 11.7 Mute `friend_requests`: trigger both events → no push, no email; other channel state unchanged
- [ ] 11.8 All-channels-off: disable both → disclaimer visible; trigger events → no notifications dispatched
- [ ] 11.9 Multi-device: register push on two browsers same account → one event delivers to both
- [ ] 11.10 Stale subscription: revoke permission in browser without unsubscribing, trigger event → Worker logs 410, row deleted (verify via SQL)
- [ ] 11.11 Unauthorized dispatch: hand-craft a `POST /notify/friend-request-received` with a JWT for a user who is NOT the sender → Worker returns 403, no dispatch
- [ ] 11.12 Response notification body inspection: confirm neither push body nor email body reveals accept vs decline outcome

## 12. Finalize

- [ ] 12.1 `npx eslint . --fix` — zero warnings
- [ ] 12.2 `npm run type-check`
- [ ] 12.3 `npm run test` — all green
- [ ] 12.4 Confirm all manual smoke tests in §11 passed; paste results checklist into PR
- [ ] 12.5 Prompt user to commit with message: `feat(notifications): friend request push and email notifications (#112)`
- [ ] 12.6 Prompt user to push branch and open PR linking issue #112
