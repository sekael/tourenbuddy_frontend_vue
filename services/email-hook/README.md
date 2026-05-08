# tourenbuddy-email-hook

Cloudflare Worker implementing the Supabase "Send Email Hook". Receives Supabase auth email payloads via HMAC-verified webhook, picks a Brevo transactional template based on the user's locale, and sends the OTP code email.

See implementation spec: `../../openspec/changes/switch-auth-to-otp/`

## Brevo templates

Create two Brevo transactional templates: **Transactional → Templates → Create a template**.

| Template name | Subject (Brevo)                 | Language |
| ------------- | ------------------------------- | -------- |
| `otp_en`      | `Your TourenBuddy sign-in code` | EN       |
| `otp_de`      | `Dein TourenBuddy-Anmeldecode`  | DE       |

- Sender: `no-reply@tourenbuddy.ch`
- Note the numeric `templateId` from the template detail page — you need it for `BREVO_TEMPLATE_EN` / `BREVO_TEMPLATE_DE`.

Required template params (passed by Worker):

- `{{ params.otp }}` — the 6-digit sign-in code
- `{{ params.email }}` — the recipient's email address

Include a "Do not share this code. It expires in 1 hour." warning in the template body.

## Secrets

Set all secrets via Wrangler before deploying:

```sh
wrangler secret put BREVO_API_KEY
wrangler secret put SEND_EMAIL_HOOK_SECRET
wrangler secret put BREVO_TEMPLATE_EN   # numeric ID of otp_en template
wrangler secret put BREVO_TEMPLATE_DE   # numeric ID of otp_de template
```

No `[vars]` configuration required in `wrangler.toml`.

## Deploy

```sh
npm install
wrangler login
wrangler deploy
```

Note the Worker URL from the deploy output — you need it to configure the Supabase Send Email Hook.

## Local dev

```sh
wrangler dev
```

## Tests

```sh
npm test
```
