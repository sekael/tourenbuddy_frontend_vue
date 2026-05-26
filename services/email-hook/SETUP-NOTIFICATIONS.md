# Notification Setup Checklist

Follow these steps in order to enable push and email notifications for friend requests.

## Security audit note

The Web Push library used in this Worker (`@block65/webcrypto-web-push` v1.0.2) was vetted against:

- `npm audit --omit=dev` → 0 vulnerabilities in production deps
- GitHub Advisory Database → no advisories
- socket.dev → maintained, last published Dec 2024, MIT licence

## 1. Generate VAPID keypair

```sh
npx web-push generate-vapid-keys
```

Copy the output — you will need both `publicKey` and `privateKey` in step 3.

## 2. Create Brevo transactional templates

Go to **Brevo → Transactional → Email Templates → Create a template**.

Create the templates by pasting the corresponding files from `brevo-templates/`:

| File                                        | Template name (suggestion)    | Note                                                         |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `friend_request_received_en.html` + `.txt`  | `friend_request_received_en`  | Subject line is in the HTML top comment                      |
| `friend_request_received_de.html` + `.txt`  | `friend_request_received_de`  |                                                              |
| `friend_request_responded_en.html` + `.txt` | `friend_request_responded_en` | Never reveals accept/decline                                 |
| `friend_request_responded_de.html` + `.txt` | `friend_request_responded_de` |                                                              |
| `tour_updates_en.html` + `.txt`             | `tour_updates_en`             | Generic; params: `action`, `actorName`, `tourName`, `appUrl` |
| `tour_updates_de.html` + `.txt`             | `tour_updates_de`             | `action` ∈ created/updated/deleted                           |
| `tour_interest_en.html` + `.txt`            | `tour_interest_en`            | params: `actorName`, `tourName`, `appUrl`                    |
| `tour_interest_de.html` + `.txt`            | `tour_interest_de`            |                                                              |

For each template:

1. Create template, paste HTML into the HTML editor and TXT into the plain-text editor.
2. Set sender to `no-reply@tourenbuddy.ch`.
3. Save and **activate** the template.
4. Note the numeric **Template ID** from the URL or template details page.

## 3. Set Worker secrets

> **Env var naming:** Worker secrets use **plain names** (no `VITE_` prefix). The `VITE_` prefix is exclusively for the **frontend** (Vite injects `VITE_*` into the client bundle). Worker code reads `env.VAPID_PUBLIC_KEY`, not `env.VITE_VAPID_PUBLIC_KEY`. Setting `VITE_*` variants on the Worker has no effect.

```sh
cd services/email-hook

# Supabase
wrangler secret put SUPABASE_URL
# → paste: https://<your-project>.supabase.co

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# → paste service role key from Supabase project settings

# VAPID (from step 1)
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
# → paste: mailto:no-reply@tourenbuddy.ch

# Brevo template IDs (numeric, from step 2)
wrangler secret put BREVO_TEMPLATE_FRIEND_RECEIVED_EN
wrangler secret put BREVO_TEMPLATE_FRIEND_RECEIVED_DE
wrangler secret put BREVO_TEMPLATE_FRIEND_RESPONDED_EN
wrangler secret put BREVO_TEMPLATE_FRIEND_RESPONDED_DE
wrangler secret put BREVO_TEMPLATE_TOUR_UPDATES_EN
wrangler secret put BREVO_TEMPLATE_TOUR_UPDATES_DE
wrangler secret put BREVO_TEMPLATE_TOUR_INTEREST_EN
wrangler secret put BREVO_TEMPLATE_TOUR_INTEREST_DE

# Optional: app URL used for push deep-links / email links
# Defaults to https://test.tourenbuddy.ch if unset. Override when prod domain goes live:
wrangler secret put APP_URL
# → paste: https://test.tourenbuddy.ch    (staging — or omit, this is the default)
# → paste: https://tourenbuddy.ch         (prod — once live)
```

> **CORS allowlist** is hard-coded in `src/config.ts` (`ALLOWED_ORIGINS`): `localhost:5173`, `test.tourenbuddy.ch`, `tourenbuddy.ch`, `www.tourenbuddy.ch`, plus `*.touringbuddy.pages.dev`. Add any new frontend origin there and redeploy the Worker.

## 4. Apply Supabase migration

```sh
supabase db push
```

This adds `notif_push_enabled`, `notif_email_enabled`, `notif_muted_types` columns to `user_profile`
and creates the `push_subscriptions` table with RLS.

## 5. Set frontend environment variables

In **Cloudflare Pages → Settings → Environment variables** (and in your local `.env.local`):

```
VITE_VAPID_PUBLIC_KEY=<publicKey from step 1>
VITE_NOTIFY_HOOK_URL=https://tourenbuddy-email-hook.<your-account>.workers.dev
VITE_NOTIFICATIONS_ENABLED=true
```

> **The `VITE_` prefix is required for these** — Vite only exposes env vars with that prefix to client code. Do NOT add `VITE_` prefix to Worker secrets (step 3); those are read server-side without the prefix. `VITE_VAPID_PUBLIC_KEY` (frontend) and `VAPID_PUBLIC_KEY` (Worker) must hold the **same value** — they are the same keypair, just named per consumer convention.

> **`VITE_NOTIFY_HOOK_URL` MUST include the `https://` scheme.** The frontend validates it via `z.string().url()`; a bare hostname like `tourenbuddy-email-hook.<account>.workers.dev` fails validation and the app blank-screens on boot. Always paste the full URL.

### GitHub Actions secrets (for CI deploys)

The CI workflows (`build-web-and-push.yml`, `deploy-preview.yml`) construct `.env` from GitHub Actions secrets at build time. Pages dashboard env vars are NOT used by these workflows. Set under **repo → Settings → Secrets and variables → Actions → Repository secrets**:

| Secret name             | Value                                                  | Notes                                                              |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `SUPABASE_URL`          | `https://<project>.supabase.co`                        | Include `https://` scheme                                          |
| `SUPABASE_ANON_KEY`     | publishable/anon key                                   |                                                                    |
| `VAPID_PUBLIC_KEY`      | VAPID publicKey                                        | Same value as Worker secret                                        |
| `NOTIFY_HOOK_URL`       | `https://tourenbuddy-email-hook.<account>.workers.dev` | **Include `https://` scheme — bare hostname fails URL validation** |
| `CLOUDFLARE_API_TOKEN`  | Pages:Edit-scoped token                                | For `wrangler pages deploy`                                        |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                                  |                                                                    |

## 6. Deploy

```sh
# Deploy Worker
cd services/email-hook && wrangler deploy

# Deploy frontend (triggers Cloudflare Pages build)
git push
```

## Local development & manual testing

End-to-end notification testing against the local Supabase stack is supported. Push works fully offline; email requires a real Brevo key (Inbucket cannot receive Brevo API calls).

### Prerequisites

- Local Supabase running (`supabase start`) — see project README
- Two seeded users (or two browser profiles signed in to local stack with phone-verified accounts so `friend_requests` can flow)
- VAPID keys (one-time):
  ```sh
  npx web-push generate-vapid-keys
  ```

### 1. Configure the worker for local dev

Create `services/email-hook/.dev.vars` (gitignored):

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status` → Authentication Keys → Secret (sb_secret_…)>
SEND_EMAIL_HOOK_SECRET=v1,whsec_local_dev_only_not_used_for_notify_routes
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:dev@localhost

# Email path is optional in local dev — leave blank to skip
BREVO_API_KEY=
BREVO_TEMPLATE_FRIEND_RECEIVED_EN=
BREVO_TEMPLATE_FRIEND_RECEIVED_DE=
BREVO_TEMPLATE_FRIEND_RESPONDED_EN=
BREVO_TEMPLATE_FRIEND_RESPONDED_DE=
BREVO_TEMPLATE_TOUR_UPDATES_EN=
BREVO_TEMPLATE_TOUR_UPDATES_DE=
BREVO_TEMPLATE_TOUR_INTEREST_EN=
BREVO_TEMPLATE_TOUR_INTEREST_DE=
```

> `wrangler dev` runs workerd directly on the host (not in a Docker container), so `127.0.0.1:54321` reaches the Supabase stack via host loopback. Do not use `host.docker.internal` — it only resolves inside Docker.

Run:

```sh
cd services/email-hook
npm install
npx wrangler dev --port 8787
```

### 2. Configure the frontend

In `.env.local` at repo root:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<from `supabase status`>
VITE_VAPID_PUBLIC_KEY=<same publicKey from step 1>
VITE_NOTIFY_HOOK_URL=http://127.0.0.1:8787
VITE_NOTIFICATIONS_ENABLED=true
```

Restart `npm run dev` after editing `.env.local`.

### 3. Manual test flow

1. Open the app in **Chrome/Edge** (Firefox blocks Web Push for `http://localhost` without flags). Sign in as user A. Visit profile → notifications, toggle **Push** on, accept the browser permission prompt. Confirm a row appears in `push_subscriptions` (Studio → Table editor).
2. Open a **second profile** (incognito or different browser profile), sign in as user B, repeat step 1.
3. As user A, send a friend request to user B (phone search).
4. Expect: user B's browser shows a system notification "New friend request — A wants to connect.". `wrangler dev` log shows `POST /notify/friend-request-received 200`.
5. As user B, accept (or deny) the request.
6. Expect: user A's browser shows "Friend request update — B responded to your request." (no accept/decline wording leaked). `wrangler dev` log shows `POST /notify/friend-request-responded 200`.

### 4. Edge cases to verify manually

- Recipient toggles **Push off** → no notification, but `200` returned by worker.
- Recipient mutes the `friend_requests` type → no notification, `200`.
- Worker offline (`wrangler dev` killed) → app continues to function; dispatch is fire-and-forget and only logs a warning.
- Sender lacks JWT (e.g. session expired) → no dispatch (silent return in `notify-dispatch.ts`).

### 5. Email path (optional)

Local Inbucket/Mailpit only receives mail sent via Supabase Auth's local SMTP. The worker calls Brevo's API directly — there is no local capture for that. To exercise the email path you need a real Brevo sandbox key + template IDs in `.dev.vars`. Otherwise leave Brevo vars blank: `email.ts` short-circuits and the test still validates push.

## 7. Rollback

If notifications cause issues, disable dispatch without touching the database:

1. Set `VITE_NOTIFICATIONS_ENABLED=false` in Cloudflare Pages environment variables.
2. Trigger a redeploy (empty commit or Pages dashboard redeploy button).

The `push_subscriptions` table and user preference columns remain — re-enable is instant.
