# tourenbuddy-email-hook

Cloudflare Worker that implements the Supabase "Send Email Hook". Receives Supabase auth email payloads via HMAC-verified webhook, picks a Brevo transactional template based on the user's locale, and sends the magic link email.

See implementation spec: `../../openspec/changes/switch-to-magic-link-auth/`

## Brevo templates

Ready-to-use templates are in `templates/`:

| File | Purpose | Brevo name |
|---|---|---|
| `magic_link_en.html` | HTML body (EN) | `magic_link_en` |
| `magic_link_en.txt` | Plaintext fallback (EN) | — |
| `magic_link_de.html` | HTML body (DE) | `magic_link_de` |
| `magic_link_de.txt` | Plaintext fallback (DE) | — |

In Brevo: **Transactional → Templates → Create a template**.  
- Subject EN: `Your TourenBuddy sign-in link`  
- Subject DE: `Dein TourenBuddy-Anmeldelink`  
- Sender: `no-reply@tourenbuddy.ch`  
- Paste HTML content, paste plaintext content.  
- Note the numeric `templateId` from the template detail page — you need it for `BREVO_TEMPLATE_EN` / `BREVO_TEMPLATE_DE`.

Required params (passed by Worker, referenced in templates):
- `{{ params.magic_link }}` — the full sign-in URL
- `{{ params.email }}` — the recipient's email address

## Secrets

Set all secrets via Wrangler before deploying:

```sh
wrangler secret put BREVO_API_KEY
wrangler secret put SEND_EMAIL_HOOK_SECRET
wrangler secret put BREVO_TEMPLATE_EN
wrangler secret put BREVO_TEMPLATE_DE
```

Set `SUPABASE_URL` in `wrangler.toml` under `[vars]` (non-secret).

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
