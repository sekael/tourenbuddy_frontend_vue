# Design

## Context

Notifications are recorded by the database and delivered by the Worker (`docs/notifications.md`):
`fn_dispatch_notification` posts each inbox row to `POST /notify/event`, which picks the channels.
Push today is Web Push only (`push_subscriptions`, VAPID). The native apps register OS push tokens
instead. Account deletion has no path at all, and abuse reports land in a table nobody watches.

## Decisions

### D1: APNs directly for iOS, FCM HTTP v1 for Android

#346 D10 left open how iOS gets an FCM token (Expo's `getDevicePushTokenAsync` returns the raw
APNs token on iOS). Options:

| Option | iOS app | Worker |
|---|---|---|
| Firebase iOS SDK in the app for an FCM token | adds `@react-native-firebase/*`, a Google SDK and processor for every iOS user, a config file per variant | one sender |
| **Direct APNs** | nothing beyond `expo-notifications` | a second sender (~80 lines) |

Direct APNs keeps Google out of the iOS app and its privacy label, and the Worker already signs
JWTs with WebCrypto. APNs requires HTTP/2; Workers' `fetch` reaches it (the Bark server and
`cloudflare-apns2` run on Workers). If APNs ever refuses the Worker, the fallback is the Firebase
SDK option, with no schema change (a token row only gains a different `platform` path).

APNs: `POST https://api.push.apple.com/3/device/<token>` (`api.sandbox.push.apple.com` for
development builds), `authorization: bearer <ES256 JWT>` (`iss` team, `kid` key id, re-signed every
50 minutes, Apple rejects older than an hour and newer than 20 minutes apart as too many),
`apns-topic: <bundle id>`, `apns-push-type: alert`, body
`{"aps":{"alert":{"title","body"},"sound":"default","badge":<unread>},"url":"…"}`: the badge is
the user's unread inbox entries (one `HEAD … Prefer: count=exact`), left out when the count fails;
the app sets it itself while it runs.

FCM: OAuth2 access token from the service-account JSON (RS256 JWT grant to
`https://oauth2.googleapis.com/token`, scope `firebase.messaging`), cached until five minutes before
it expires; `POST https://fcm.googleapis.com/v1/projects/<project>/messages:send` with
`{message:{token, notification:{title, body}, data:{url}, android:{priority:"high"}}}`.

Both caches live in the isolate's memory: a cold isolate signs once more, which costs a
millisecond of CPU on the free plan.

### D2: A separate table, not more columns on `push_subscriptions`

The two rows have nothing in common but the user: an endpoint with keys versus an opaque token
with a platform, a topic and an environment. Keeping them apart lets B9 drop the Web Push table
after cutover without touching native delivery.

```sql
device_push_tokens(
  id uuid pk, user_id uuid → auth.users on delete cascade,
  platform 'ios' | 'android', token text unique,
  app_id text            -- bundle id / package; the APNs topic
  apns_environment 'development' | 'production' | null   -- required for iOS
  app_version text, created_at, last_seen_at)
```

RLS: the owner may select and delete their rows (sign-out deletes its own token directly); no
insert or update privilege. `register_device_push_token(token, platform, app_id,
apns_environment, app_version)` is SECURITY DEFINER, checks `auth.uid()`, validates platform,
app id (`ch.tourenbuddy.app` or `.dev`) and lengths, and upserts on `token` so **the last account
to register a device owns it**, as `register_push_subscription` does for browsers.

### D3: The client reports the APNs environment

A development-signed build (the owner's `expo run:ios`, either variant) gets sandbox tokens; App
Store and TestFlight builds get production tokens. Neither the variant nor `__DEV__` tells them
apart; the provisioning profile does, and `expo-application` reads its `aps-environment`. The
Worker picks the APNs host from the row.

### D4: Stale tokens

| Reply | Meaning | Row |
|---|---|---|
| APNs 410 `Unregistered`, 400 `BadDeviceToken`, 400 `DeviceTokenNotForTopic` | token gone or never valid for this app | deleted |
| FCM 404 `UNREGISTERED`, 400 `INVALID_ARGUMENT` naming `message.token` | token gone or malformed | deleted |
| FCM 400 `INVALID_ARGUMENT` naming anything else | our payload is wrong | kept, logged |
| 403, 429, 5xx, network error | our credentials, rate, or their outage | kept, logged |

A missing APNs or FCM secret skips that platform with one warning per event; Web Push and email
still go out.

### D5: Account deletion is a Worker route

Deleting the auth user and Storage objects needs the service role, which only the Worker holds.
`POST /account/delete` with the user's JWT (`verifySupabaseJwt`, never an id from the body):

1. Delete every object under `<uid>/` in `tour-gpx` and `tour-attachments`. Storage's list API
   walks one folder level per call, and attachments nest by tour (`<uid>/<tourId>/<id>.<ext>`), so
   the Worker asks the database instead: `account_storage_objects(uid)`, a definer function granted
   to `service_role` only, returns the bucket and name of each object whose first path segment is
   the user. The Worker then deletes them through the Storage API (`DELETE object/<bucket>` with up
   to 1,000 names per call), which removes the stored file and its row. Objects first: if this fails
   the account stays, the answer is 502, and the user can retry. The other order would leave files
   of a deleted account that no one can reach.
2. `DELETE /auth/v1/admin/users/<uid>`. Every `public` table references the user (or their tours
   and contacts) with `on delete cascade`; `abuse_reports` sets both ids to null by design, so a
   report outlives the reporter and the reported, anonymized. Device tokens and Web Push
   subscriptions go with the user.

Deletion is silent. The cascade runs without a JWT, so `auth.uid()` is null in every trigger:
`fn_notify_tour_deleted` skips its notice (`auth.uid() is distinct from old.user_id`) and
`fn_emit_notification` returns when it has no actor, which covers link-group removals fired by the
friendship deletes. Friends see the tours and the friendship disappear through Realtime. The pgTAP
suite deletes a seeded user with friends, links, suggestions, partners and reports and checks all
of this.

The PWA's profile sheet gets "Delete account": a confirmation dialog naming what goes, then the
call, then sign-out. Other devices keep a valid access token for up to an hour, but every read
returns nothing and every write fails on the missing profile; their refresh fails and signs out.

### D6: Abuse report alert

App Review 1.2 asks for a way to report and a timely response. `report_user` already writes
`abuse_reports`; an AFTER INSERT OR UPDATE trigger (`fn_dispatch_abuse_report`) posts
`{id, reporter_user_id, reported_user_id, reason, created_at}` to `/moderation/report` with the
notification Vault URL and secret, exactly as `fn_dispatch_notification` does (never raises, skips
when Vault is unset, as locally). The Worker checks the secret, looks up both accounts' names and
emails, and sends a plain Brevo email (no template) to `MODERATION_EMAIL`. Unset → 200
`skipped`. Process and the 24-hour response target: `docs/moderation.md`.

### D7: B8, the `tours_select_friend` gap, reviewed

The policy lets an accepted friend read a friends-visible tour's full row from `tours`, including
`planned_date`, `end_date` and `gpx_filepath`, which `friend_tours_view` shows only to partners.
Native clients change nothing here: the gap is reachable with the anon key and a JWT from any HTTP
client today, and the native app reads `friend_tours_view` like the PWA. What is exposed is
limited to friends who were accepted by the owner and to tours the owner marked friends-visible;
GPX objects stay behind their own Storage policy, which already gates by partnership.

Fix (follow-up, not here): replace `tours_select_friend` with a definer read path
(`friend_tours(...)` returning the partner-gated columns) and switch `friend_tours_view` to it in
both clients, expand-then-contract (D8), so old app versions keep reading until the gate passes.
Recorded in `.claude/architecture.md` as reviewed for the store release, with this shape. The
owner's acceptance of the deferral is a gate of the store release (Phase 6, #373).

### D8: Expand, then contract

Store builds stay in the field for months. Any RPC or table change adds the new shape first, keeps
the old one working, and removes it only when `app-config.json`'s minimum versions exclude every
build that uses it. Written into `AGENTS.md` and `.claude/conventions.md`.

### D9: CORS

Added: `https://tourenbuddy-native.pages.dev`, its previews `*.tourenbuddy-native.pages.dev`, and
`http://localhost:8081` (Expo web dev). A request without `Origin` (native apps, servers) gets no
CORS headers and is handled on its JWT, as before.

## Risks

- **APNs over Workers fetch:** verified only by others' projects. The first deploy's manual check
  (a push to the owner's iPhone) settles it; fallback in D1.
- **Deletion on the free plan's 50 subrequests:** one call for the JWT, one for the object list,
  one delete per 1,000 objects per bucket, one for the user: far below the limit for any account
  the attachment caps allow.
