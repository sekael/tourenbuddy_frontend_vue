## Why

Email OTP requires users to copy an 8-character code between client (mail) and app, adding friction and a failure mode (mistyping). Magic links remove the manual code-entry step and feel modern. While reworking auth, we also fix the long-standing limitation that Supabase's built-in email templates support only one language — DE/EN users currently receive English-only mail.

## What Changes

- **BREAKING**: Replace email OTP authentication with email magic link. Remove OTP code entry UI and `verifyOtp` action.
- Add `/auth/callback` route to handle Supabase PKCE token exchange after magic link click.
- Replace `verify-otp-page.vue` with `check-email-page.vue` (instructional + resend, no input).
- Pass user's locale (`de` or `en`) into Supabase user metadata at sign-up (derived from browser language) and keep it synced with the in-app language choice afterwards.
- Add a Cloudflare Worker (in-repo subdir `services/email-hook/`) that implements Supabase's "Send Email Hook", picks a Brevo transactional template by user locale, and sends magic link mail from `no-reply@tourenbuddy.ch`.
- Hard-cut: no fallback to OTP.

## Capabilities

### New Capabilities

- `auth-email-hook`: Server-side webhook that intercepts Supabase auth emails and sends locale-specific magic link templates via Brevo.

### Modified Capabilities

- `auth`: OTP code flow replaced with magic link flow; new callback route; locale stored in user metadata.
- `user-profile`: Profile language selection writes locale into Supabase `user_metadata.locale` so future auth emails use it.
- `i18n`: Locale resolution now also seeds `user_metadata.locale` at first sign-up from `navigator.language`.

## Impact

- **Frontend code**: `src/features/auth/**`, `src/app/router/index.ts`, `src/locales/{en,de-CH}.json`, `src/features/user/presentation/stores/user-profile-store.ts`, related tests.
- **New code**: `services/email-hook/` (Cloudflare Worker, `wrangler.toml`, deploy independent of Pages).
- **External config**:
  - Supabase Dashboard: enable Send Email Hook, point at Worker URL, disable built-in email template's body for magic_link.
  - Brevo: sender `no-reply@tourenbuddy.ch` already verified (used today for OTP) — only create two new transactional templates (`magic_link_en`, `magic_link_de`).
  - Cloudflare DNS for `tourenbuddy.ch`: SPF/DKIM/DMARC already in place — sanity check only, no new records.
  - Cloudflare: deploy Worker, set secrets (`BREVO_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, template IDs).
- **Dependencies**: no new runtime npm deps in main app. Worker uses `standardwebhooks` for HMAC verification.
- **Risk**: deliverability depends on correct DNS setup; broken DNS = no auth emails. Mitigate with staging test before flipping hook.
