## Context

App uses Supabase (Auth + PG + RLS) and a Cloudflare Worker (`services/email-hook`) that already talks to Brevo for transactional email (OTP). PWA via `vite-plugin-pwa` with Workbox. No prior notifications infra. Friendships table holds requests with sender/recipient + status. Locale stored on `user_profiles.locale`.

Free-tier project, low traffic. No background workers. Mobile users mostly Android/iOS PWA.

## Goals / Non-Goals

**Goals:**
- Users can opt into push, email, both, or none — globally and per type.
- Recipient gets notified on incoming friend request.
- Requester gets notified on response (no accept/decline disclosed).
- Web Push works on Android Chrome, desktop browsers, iOS 16.4+ as installed PWA.
- Email localized to user's profile locale.
- Multi-device push.

**Non-Goals:**
- In-app notification center / inbox.
- Native iOS APNs.
- Real-time channels for any other domain (tours, contacts) — extensible but not built.
- Retry queue / dead letter — best-effort dispatch.

## Decisions

### D1. Trigger from client, not DB webhook
**Choice:** Friendships store calls Worker `/notify/...` route after RPC succeeds. Worker is authenticated with the caller's Supabase JWT.
**Why:** No DB webhook plumbing, easier local dev, Worker can verify the actor and resolve recipient prefs+subscriptions via service role. Loss of a notification when client crashes mid-call is acceptable for v1.
**Alts:** DB webhook (more reliable, extra infra), pg_net (DB-side complexity).

### D2. Extend existing email-hook Worker
**Choice:** Add routes `/notify/friend-request-received`, `/notify/friend-request-responded` and a `/push/subscribe` (or handle subscribe via Supabase directly — see D5). Reuse Brevo client + secrets layout. Keep auth-email-hook route untouched.
**Why:** Single deploy unit, shared Brevo plumbing, minimal new infra.
**Alts:** Separate Worker (more isolation, more ops).

### D3. Notification preferences storage
**Choice:** Add columns to `user_profiles`:
- `notif_push_enabled boolean not null default false`
- `notif_email_enabled boolean not null default false`
- `notif_muted_types text[] not null default '{}'` — open-ended string set, v1 accepts only `friend_requests`. Future values: `tour_invites`, `tour_updates`, etc. No DB enum so we never need migrations to add a type. Frontend validates against a TS union; unknown values are ignored.
**Why:** Simple, queryable, RLS already in place on `user_profiles`. Per-type list is extensible without schema churn.
**Alts:** `notification_preferences` JSONB (less typed), separate table (overkill for v1).

### D4. Push subscriptions table
```
push_subscriptions(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
)
```
RLS: `user_id = auth.uid()` for select/insert/delete. Service role bypasses for Worker dispatch. Index on `user_id`.

### D5. Subscription registration path
**Choice:** Frontend writes the `PushSubscription` directly to `push_subscriptions` via PostgREST under user RLS. No Worker route for subscribe. Unsubscribe deletes by `endpoint`.
**Why:** Less Worker surface. RLS gives us auth for free.

### D6. VAPID and Web Push library in Worker
**Choice:** Use `@block65/webcrypto-web-push` (Workers-native, zero runtime deps, MIT). Validate before pinning: run `npm audit`, check GitHub Advisory DB and `socket.dev` for the package + transitive deps; reject if any high/critical CVE is unpatched or repo is unmaintained (>12 months no commit + open security issues). If rejected, fallback candidate is `@negrel/webpush`. The classic `web-push` (Node) is not used — it pulls Node crypto bindings unsuitable for CF Workers and has a heavier dep tree.
Generate VAPID keypair once via `npx web-push generate-vapid-keys`, store as Worker secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:no-reply@tourenbuddy.ch`). Public key also exposed to frontend via env (`VITE_VAPID_PUBLIC_KEY`).

### D7. Worker authentication
**Choice:** Worker verifies `Authorization: Bearer <supabase_access_token>` by calling Supabase `/auth/v1/user` once per request (cache verifier briefly per JWT if needed). Worker uses Supabase service-role key for prefs/subscription lookups. Reject if caller is not the actor implied by the route payload (e.g., for `/notify/friend-request-received`, the caller must be the sender).
**Why:** Prevents notification spam from arbitrary clients.

### D8. Payload contract
```
POST /notify/friend-request-received
Authorization: Bearer <jwt>
{ "friendshipId": "<uuid>" }

POST /notify/friend-request-responded
Authorization: Bearer <jwt>
{ "friendshipId": "<uuid>" }
```
Worker reads the friendship row to determine recipient + sender, prevents impersonation, derives locale.

### D9. Push notification content
- Received: title localized "New friend request", body "<requester display name> wants to connect."
- Responded: title localized "Friend request update", body "<responder display name> responded to your request."
- Click action: deep link to `/?friendRequests=1` (opens friend requests sheet).
- No outcome leak.

### D10. iOS PWA gating
At runtime detect (a) iOS user agent and (b) `window.matchMedia('(display-mode: standalone)').matches`. If iOS && not standalone, hide the push toggle and show install instructions instead. Email toggle remains.

### D11. i18n
Frontend keys under `notifications.*` in `en.json` and `de-CH.json`. Brevo templates: `friend_request_received_en`, `friend_request_received_de`, `friend_request_responded_en`, `friend_request_responded_de`. Each accepts params `actorName`, `appUrl`.

Copy-ready template drafts live in `services/email-hook/brevo-templates/<name>.html` (and `<name>.txt` for plain-text fallback). README points operators to paste these into Brevo's editor.

### D12. Disclaimer when all channels off
Profile UI shows a warning block when `notif_push_enabled === false && notif_email_enabled === false`, or when all relevant types are muted. Wording: "You won't receive friend request notifications or other important updates."

### D13. Notification type taxonomy (extensible)
v1 defines a single type `friend_requests` covering both `friend_request_received` and `friend_request_responded` events. The user mute model is event-class, not event-instance — one toggle silences both received and responded for friend requests. Future types added without migrations: declare in TS union + i18n keys + (optional) Brevo templates.

```ts
type NotificationType = 'friend_requests' // future: | 'tour_invites' | 'tour_updates'
```

The Worker maps event → type internally:
- `friend_request_received` → type `friend_requests`
- `friend_request_responded` → type `friend_requests`

### D14. Manual setup checklist
A single source of truth at `services/email-hook/SETUP-NOTIFICATIONS.md` covers, in order: VAPID generation, Brevo template creation (with paths to copy from `brevo-templates/`), Worker secret population, Supabase migration apply, frontend env vars, deploy steps, and rollback. Linked from main README.

## Risks / Trade-offs

- **iOS push reliability** → User must install PWA. Mitigated by D10 gating + clear copy.
- **Client-triggered dispatch loses notifications on crash mid-RPC** → Acceptable for v1; future move to DB webhook documented.
- **Worker JWT verification adds Supabase round-trip per dispatch** → Low traffic, fine. Could cache later.
- **Brevo template drift across locales** → Mitigate with checklist in services/email-hook README.
- **Push subscription churn (browser-rotated endpoints)** → 410/404 from Web Push: Worker deletes the row.
- **Service worker push handler conflicts with PWA precache SW** → Use `vite-plugin-pwa` `injectManifest` strategy with custom `sw.ts`, or extend `additionalManifestEntries` + `runtimeCaching` while adding push listeners. Decide during implementation.
- **No retries** → If Brevo or push fails, lost. Acceptable; log via consola in Worker.

## Migration Plan

1. DB migration: add `push_subscriptions` table + columns on `user_profiles`. Defaults preserve current behavior (push+email on, no mutes).
2. Generate VAPID keys; set Worker secrets; set frontend env.
3. Create four Brevo templates; capture IDs; set Worker secrets.
4. Deploy Worker with new routes (additive — old `/email-hook` untouched).
5. Ship frontend: prefs UI, subscription registration on permission grant, dispatch calls in friendships store, service worker push handlers.
6. Rollback: feature-flag dispatch calls behind `VITE_NOTIFICATIONS_ENABLED`. If broken, flip flag; data tables remain harmless.

## Open Questions

- Should `services/email-hook` be renamed to `services/notify-hook`? Defer — keep name to avoid worker URL change; rename in a later cleanup.
- Use `injectManifest` vs. `generateSW` for PWA? Decide in implementation; `injectManifest` likely needed for custom push handlers.
