## MODIFIED Requirements

### Requirement: Worker exposes Supabase Send Email Hook endpoint

A Cloudflare Worker, deployed from `services/email-hook/` in this repository, SHALL expose an HTTPS POST endpoint that conforms to the Supabase Send Email Hook contract. The endpoint SHALL accept the JSON payload Supabase posts for OTP email events and return HTTP 200 on success.

#### Scenario: Successful OTP delivery

- **WHEN** Supabase posts a valid OTP email payload (`email_action_type` = `signup` or `magiclink` with a 6-digit `token` in `email_data`) with a verifiable HMAC signature
- **THEN** the Worker SHALL return HTTP 200 after Brevo accepts the email request

#### Scenario: Brevo error

- **WHEN** Brevo's API returns a non-2xx response
- **THEN** the Worker SHALL return HTTP 502 with the Brevo error code in the body so Supabase can log and retry per its hook policy

### Requirement: Worker sends through Brevo transactional API

The Worker SHALL send each email through the Brevo `POST /v3/smtp/email` endpoint using the API key stored as `BREVO_API_KEY`. The request body SHALL set `to[0].email` to the recipient, `templateId` to the locale-resolved OTP template, `params` to `{ otp, email }`, and SHALL omit `htmlContent`/`subject` so the Brevo template owns those.

#### Scenario: Outbound payload shape

- **WHEN** the Worker calls Brevo for a German user `u@example.com` with OTP code `123456`
- **THEN** the request body SHALL equal `{ "to": [{ "email": "u@example.com" }], "templateId": <BREVO_TEMPLATE_DE>, "params": { "otp": "123456", "email": "u@example.com" } }`

#### Scenario: Sender derived from Brevo template

- **WHEN** the Brevo templates are configured with sender `no-reply@tourenbuddy.ch`
- **THEN** the Worker SHALL NOT override the sender in the API call

### Requirement: Worker is the sole auth-email sender in production

When the Send Email Hook is enabled in the production Supabase project, Supabase SHALL NOT send OTP emails through its built-in SMTP. The Worker SHALL be the only path that produces a delivered OTP email.

#### Scenario: Hook enabled

- **WHEN** the production Supabase Auth Hook configuration shows the Send Email Hook pointing at the Worker URL and "enabled"
- **THEN** subsequent `signInWithOtp` requests SHALL route email delivery through the Worker

## ADDED Requirements

### Requirement: Worker passes the OTP code to the Brevo template

The Worker SHALL read `email_data.token` (the 6-digit OTP issued by Supabase) from the payload and pass it to the Brevo template as `params.otp`.

#### Scenario: OTP forwarded verbatim

- **WHEN** the payload contains `email_data.token = "123456"`
- **THEN** the Worker SHALL include `params.otp = "123456"` in the Brevo request body and SHALL NOT transform, hash, or truncate it

#### Scenario: Missing token

- **WHEN** the payload omits `email_data.token` or the value is empty
- **THEN** the Worker SHALL return HTTP 400 and SHALL NOT contact Brevo

## REMOVED Requirements

### Requirement: Worker constructs magic link URL

**Reason**: Magic link auth has been removed from the app (see `auth` spec). The Worker no longer builds a verify-endpoint URL; it forwards the 6-digit OTP code instead.

**Migration**: Delete the URL composition logic in `services/email-hook/src/index.ts`. The Brevo template parameter `magic_link` SHALL be replaced by `otp`. The Cloudflare Worker var `SUPABASE_URL` is no longer required by this Worker and MAY be removed from `wrangler.toml` `[vars]`.
