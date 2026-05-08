## Why

Magic link auth breaks the installed-PWA experience: clicking the link in the mail client always opens the system browser, never the standalone PWA window, so the session lands in the wrong context and the user has no way to copy the link into the app. Email OTP — the method used before #78 — works identically across PWA, browser, desktop, and mobile because the user types a 6-digit code directly into the app. We revert the user-facing flow to OTP while preserving the locale-aware Brevo email hook that #78 introduced (it is still useful for OTP mail, just with a different template).

## What Changes

- **BREAKING**: Replace email magic link authentication with email OTP code entry. Remove `emailRedirectTo` from `signInWithOtp` and remove the `/auth/callback` PKCE exchange flow.
- Restore `verify-otp-page.vue` (route `/auth/verify-otp`) with a 6-digit code input and a `verifyOtp({ email, token, type: 'email' })` action.
- Rename auth store action `sendMagicLink(email)` → `sendEmailOtp(email)`; re-add `verifyOtp(email, code)` action.
- Remove `check-email-page.vue` and `callback-page.vue`; the email-entry page navigates straight to `/auth/verify-otp` after submit.
- Remove `/auth/callback` from the router and from Supabase Dashboard "Redirect URLs".
- Reuse the existing `services/email-hook/` Cloudflare Worker, but switch the Brevo templates from `magic_link_*` to `otp_*` and the template parameter from `{ magic_link }` to `{ otp }` (sourced from `email_data.token`, the 6-digit code).
- Keep locale-aware emails (`user_metadata.locale`, `toEmailLocale` helper, `updateUser` on locale change) — unchanged.
- Hard-cut: no fallback to magic link.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auth`: Magic link flow replaced with OTP code flow; `/auth/callback` and `/auth/check-email` removed; `/auth/verify-otp` restored; auth store actions renamed.
- `auth-email-hook`: Worker selects OTP templates (`otp_en` / `otp_de`) and passes the OTP code (`email_data.token`) to Brevo as `params.otp` instead of constructing a magic link URL.

## Impact

- **Frontend code**: `src/features/auth/presentation/{stores/auth-store.ts, pages/*.vue}`, `src/app/router/index.ts`, `src/locales/{en,de-CH}.json`, related tests in `test/features/auth/**`.
- **Worker code**: `services/email-hook/src/index.ts`, `services/email-hook/test/index.test.ts`, `services/email-hook/README.md`.
- **External config**:
  - Brevo: create two new transactional templates `otp_en` / `otp_de` with `{{ params.otp }}` and a "do not share this code" warning. Old `magic_link_*` templates can be retired after deploy.
  - Cloudflare Worker secrets: replace `BREVO_TEMPLATE_EN` / `BREVO_TEMPLATE_DE` values with the new OTP template IDs (same secret names).
  - Supabase Dashboard → Auth → URL Configuration: remove `https://app.tourenbuddy.ch/auth/callback` from the Redirect URLs allowlist (no longer used).
  - Supabase Send Email Hook stays enabled, same Worker URL, same shared secret — payload schema unchanged.
- **Dependencies**: no npm changes.
- **Risk**: OTP reintroduces the old failure mode (mistyped code). Mitigated by clear input UI (numeric, autofill `one-time-code`) and a resend action. Brevo template swap is the cutover risk: deploy Worker template change and frontend in lockstep, otherwise users see magic link mail but the app expects an OTP code.
