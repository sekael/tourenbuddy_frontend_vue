## Context

Current auth flow: user enters email → Supabase sends 8-character OTP via its built-in email template (English only) → user copies code into `verify-otp-page.vue` → `verifyOtp({ email, token, type: 'email' })`. PKCE/redirect not used.

Constraints:

- Free tier only (Supabase Free, Cloudflare Workers Free, Brevo Free 300 emails/day).
- Domain `tourenbuddy.ch` DNS is managed in Cloudflare. Brevo sender `no-reply@tourenbuddy.ch` is already authenticated (SPF/DKIM/DMARC live) and currently sends OTP mail, so no new domain auth is required.
- App is a PWA hosted on Cloudflare Pages, i18n locales `en` and `de-CH`.
- Existing i18n spec keeps locale per-device in `localStorage['tb.locale']` and explicitly forbids syncing locale to Supabase. That rule blocks locale-aware emails and must be relaxed for a separate "email preferred locale" channel without losing per-device UI isolation.

## Goals / Non-Goals

**Goals:**

- Replace OTP code entry with click-through magic link.
- Send magic link emails in user's preferred locale (DE or EN).
- Keep email locale in sync with the user's current in-app language choice across the app's lifetime.
- No paid services; no new runtime npm deps in the Vue app.
- Worker code lives in this monorepo (`services/email-hook/`) but deploys independently of Pages.

**Non-Goals:**

- Multi-device locale sync for UI (per-device isolation in the i18n spec stays).
- OAuth, password auth, or SMS 2FA.
- Account-level locale "override" UI separate from the existing language selector.
- Email templates beyond magic link (recovery, reauth not in scope; remain default).
- Replacing PostgREST / introducing new backend services.

## Decisions

### D1. Magic link via Supabase `signInWithOtp` with `emailRedirectTo`

Use the same `signInWithOtp` endpoint, but pass `options.emailRedirectTo`. Supabase will include a magic link `…/auth/v1/verify?token=…&redirect_to=…` in the email payload. After click, Supabase redirects the browser to `${origin}/auth/callback?code=…`; with `detectSessionInUrl: true` (default) the JS client exchanges the PKCE code automatically and `onAuthStateChange` fires `SIGNED_IN`.

**Alternatives considered:**

- `signInWithMagicLink` — does not exist; `signInWithOtp` is the canonical entry point.
- Implementing our own token issuance — pointless complexity; Supabase already issues secure tokens.

### D2. Send Email Hook over per-template editing

Supabase Dashboard supports only one email template per event type. To pick by locale we use the **Send Email Hook** (HTTPS webhook): when enabled, Supabase posts the rendered email payload to our endpoint and skips its own SMTP send.

**Alternatives:**

- Multiple Supabase projects per locale — operational nightmare.
- Single template with both languages stacked — ugly, hurts deliverability and clarity.
- Server-side render with one Supabase template containing `{{ Data.locale }}` Liquid conditionals — Supabase template DSL is too limited for clean localization.

### D3. Cloudflare Worker as hook target

The app already uses Cloudflare. Workers Free covers 100k req/day — orders of magnitude above auth volume. Worker:

1. Verifies HMAC header (`webhook-id`, `webhook-timestamp`, `webhook-signature`) using `standardwebhooks` (the format Supabase emits).
2. Reads `user.user_metadata.locale` (default `en`).
3. Builds the magic link URL from `email_data.token_hash`, `email_action_type`, `redirect_to`, and the configured `SUPABASE_URL`.
4. Calls Brevo `POST /v3/smtp/email` with the chosen `templateId` and params `{ magic_link, email }`.

**Alternatives:**

- Supabase Edge Functions (Deno) — works, but keeps egress under Supabase's quota and pushes us deeper into a vendor we already pay attention to. Cloudflare matches our existing infra.
- Hostinger PHP webhook — slow, no proper secret management, weak observability.

### D4. Brevo for transactional delivery

Brevo Free = 300 emails/day, dedicated transactional API, native template engine with parameter substitution, EU data residency. Two templates: `magic_link_en` and `magic_link_de`, both with `{{ params.magic_link }}` button + plaintext fallback.

**Alternatives:**

- Hostinger SMTP — possible but no template engine; we'd render HTML in the Worker, increasing maintenance.
- Resend / Postmark — better products, but paid past trial; out of scope.
- Self-hosted SMTP — burdensome, deliverability risk.

### D5. Locale propagation: device → user_metadata, two writers

The i18n spec keeps the active locale device-local in `localStorage['tb.locale']`. We add a **separate concept**, `user_metadata.locale` ∈ `{en, de}`, treated as the user's preferred _email_ locale. Two write paths:

1. **At sign-up (no session)**: `signInWithOtp({ email, options: { data: { locale } } })` — Supabase merges `data` into `user_metadata` only when the user is created. `locale` is derived from the same browser-detection logic as the i18n store, normalized to base language (`de-CH` → `de`).
2. **After sign-up (signed-in)**: every call to `useLocaleStore().setLocale(code)` triggers, when authenticated, `supabase.auth.updateUser({ data: { locale: base(code) } })` (fire-and-forget, errors logged not surfaced). This keeps the email locale aligned with the user's most recent device choice.

Per-device UI isolation is preserved because `setLocale` still writes `localStorage['tb.locale']` and reads from it on boot; `user_metadata.locale` is consulted only by the email hook, never by the client UI.

**Alternatives:**

- Push locale only at email send time (e.g., extra Supabase-side header) — Supabase has no such mechanism for `signInWithOtp` from existing users.
- Maintain a separate `profiles.email_locale` column — extra table write per change with no benefit over `user_metadata`.

### D6. Hard-cut, no fallback

Per user instruction. Removes `verifyOtp` action and `verify-otp-page.vue`. Anyone with an in-flight OTP code will simply re-request a magic link.

### D7. New `auth-email-hook` capability spec

The Worker has its own contract (payload shape, HMAC, locale resolution, Brevo mapping) worth specifying separately so it can evolve without touching the auth UI spec.

## Risks / Trade-offs

- **DNS regression in Cloudflare blocks email delivery** → Mitigation: existing SPF/DKIM/DMARC records on `tourenbuddy.ch` already serve OTP mail; before flipping the hook re-confirm the records are unchanged in Cloudflare and the Brevo sender still shows "Authenticated".
- **Worker outage = no auth emails (no fallback)** → Mitigation: Worker has zero state and minimal code; deploy with health probe; monitor via Cloudflare logs. Acceptable risk given Workers' 99.99% SLO and our user volume.
- **Brevo 300/day cap exceeded** → Mitigation: instrument Worker to log Brevo response codes; alert on 429. Realistic ceiling for current user base; upgrade path is paid Brevo plan.
- **Pre-existing users have no `user_metadata.locale`** → Hook defaults to `en`; first time they change language post-deploy, their preference is captured. Acceptable.
- **Magic link cross-device click**: user requests on phone, opens email on laptop → laptop completes login but phone session stays unauthenticated. Mitigation: copy in `check-email-page.vue` instructs to open the link on the same device. Standard magic link UX.
- **HMAC secret rotation** requires Supabase Dashboard + Worker secret update — document in tasks.
- **Relaxing i18n "SHALL NOT be transmitted to Supabase" rule** could be perceived as privacy regression — clarify in the i18n spec delta that only the _base language code_ (`en`/`de`) is sent, and only because email content requires it.

## Migration Plan

1. Land Worker, Brevo templates, DNS, Supabase hook in a staging Supabase project; verify magic link delivery in both locales.
2. Land frontend changes behind no flag (hard-cut acceptable per D6) in a single PR.
3. Cut over: enable hook in production Supabase, deploy Pages.
4. Rollback: disable hook in Supabase Dashboard (reverts to default English OTP/magic link template) and revert frontend PR. Worker can stay deployed harmlessly.

## Open Questions

- Should `user_metadata.locale` be normalized (`de-CH` → `de`) or stored verbatim? Decision: normalize to base language since Brevo templates are per language, not per region.
- Do we want a plain-text fallback in Brevo templates? Yes — recommend in the Brevo setup task; spam filters score better with multipart.
