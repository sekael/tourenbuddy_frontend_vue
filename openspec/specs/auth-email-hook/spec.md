# auth-email-hook

Cloudflare Worker serving as Supabase Send Email Hook. Receives magic-link email events from Supabase, resolves the user's preferred language from `user_metadata.locale`, and sends through Brevo with locale-specific templates.

## ADDED Requirements

### Requirement: Worker exposes Supabase Send Email Hook endpoint

A Cloudflare Worker, deployed from `services/email-hook/` in this repository, SHALL expose an HTTPS POST endpoint that conforms to the Supabase Send Email Hook contract. The endpoint SHALL accept the JSON payload Supabase posts and return HTTP 200 on success.

#### Scenario: Successful magic link delivery

- **WHEN** Supabase posts a valid `magiclink` payload with a verifiable HMAC signature
- **THEN** the Worker SHALL return HTTP 200 after Brevo accepts the email request

#### Scenario: Brevo error

- **WHEN** Brevo's API returns a non-2xx response
- **THEN** the Worker SHALL return HTTP 502 with the Brevo error code in the body so Supabase can log and retry per its hook policy

### Requirement: Worker verifies Supabase webhook signature

The Worker SHALL verify each incoming request using the Standard Webhooks signature scheme with the secret stored as `SEND_EMAIL_HOOK_SECRET`. Requests with a missing, malformed, or invalid signature SHALL be rejected.

#### Scenario: Valid signature

- **WHEN** the request includes valid `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers matching `SEND_EMAIL_HOOK_SECRET`
- **THEN** the Worker SHALL proceed to send the email

#### Scenario: Missing or invalid signature

- **WHEN** any of the signature headers is missing or the signature does not validate
- **THEN** the Worker SHALL return HTTP 401 and SHALL NOT contact Brevo

### Requirement: Worker resolves locale from user metadata

The Worker SHALL read `user.user_metadata.locale` from the payload to choose the email template. Accepted values are `en` and `de`. Any other value (including missing) SHALL fall back to `en`.

#### Scenario: German locale

- **WHEN** the payload's `user.user_metadata.locale` equals `de`
- **THEN** the Worker SHALL select the Brevo template configured as `BREVO_TEMPLATE_DE`

#### Scenario: English locale

- **WHEN** the payload's `user.user_metadata.locale` equals `en`
- **THEN** the Worker SHALL select the Brevo template configured as `BREVO_TEMPLATE_EN`

#### Scenario: Missing or unknown locale

- **WHEN** `user.user_metadata.locale` is missing or unrecognized
- **THEN** the Worker SHALL select `BREVO_TEMPLATE_EN`

### Requirement: Worker constructs magic link URL

The Worker SHALL construct the magic link URL by combining the configured `SUPABASE_URL` with the verify endpoint and the `token_hash`, `email_action_type`, and `redirect_to` values from `email_data`.

#### Scenario: URL composition

- **WHEN** the payload contains `email_data.token_hash = T`, `email_action_type = magiclink`, and `redirect_to = R`
- **THEN** the Worker SHALL build `${SUPABASE_URL}/auth/v1/verify?token=T&type=magiclink&redirect_to=<urlencoded R>` and pass it to the Brevo template as `params.magic_link`

### Requirement: Worker sends through Brevo transactional API

The Worker SHALL send each email through the Brevo `POST /v3/smtp/email` endpoint using the API key stored as `BREVO_API_KEY`. The request body SHALL set `to[0].email` to the recipient, `templateId` to the locale-resolved template, `params` to `{ magic_link, email }`, and SHALL omit `htmlContent`/`subject` so the Brevo template owns those.

#### Scenario: Outbound payload shape

- **WHEN** the Worker calls Brevo for a German user `u@example.com` with link `L`
- **THEN** the request body SHALL equal `{ "to": [{ "email": "u@example.com" }], "templateId": <BREVO_TEMPLATE_DE>, "params": { "magic_link": "L", "email": "u@example.com" } }`

#### Scenario: Sender derived from Brevo template

- **WHEN** the Brevo templates are configured with sender `no-reply@tourenbuddy.ch`
- **THEN** the Worker SHALL NOT override the sender in the API call

### Requirement: Worker secrets and configuration

The Worker SHALL read all sensitive values from Cloudflare secrets and non-sensitive values from `wrangler.toml` `[vars]`. No secret SHALL be committed to the repository.

#### Scenario: Required secrets

- **WHEN** the Worker boots
- **THEN** the following secrets MUST be present: `BREVO_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `BREVO_TEMPLATE_EN`, `BREVO_TEMPLATE_DE`; and the following vars MUST be present: `SUPABASE_URL`

#### Scenario: Missing secret

- **WHEN** any required secret is absent at request time
- **THEN** the Worker SHALL log an error and return HTTP 500 without calling Brevo

### Requirement: Worker is the sole magic link sender in production

When the Send Email Hook is enabled in the production Supabase project, Supabase SHALL NOT send `magiclink` emails through its built-in SMTP. The Worker SHALL be the only path that produces a delivered magic link.

#### Scenario: Hook enabled

- **WHEN** the production Supabase Auth Hook configuration shows the Send Email Hook pointing at the Worker URL and "enabled"
- **THEN** subsequent `signInWithOtp` requests SHALL route email delivery through the Worker
