## Context

Auth today (post-#78): user enters email → `signInWithOtp({ email, options: { emailRedirectTo, data: { locale } } })` → Supabase calls our Send Email Hook (Cloudflare Worker at `services/email-hook/`) → Worker constructs a magic link from `email_data.token_hash` and posts it to Brevo via the `magic_link_<locale>` template → user clicks link → `/auth/callback` runs the PKCE exchange → session established.

Problem: when the app is installed as a PWA (`display: standalone`), clicking a link in the OS mail client opens the system browser, not the standalone PWA window. The session ends up in a context the user is not using, with no copy-paste path back into the PWA. The pre-#78 OTP flow (6-digit code typed into the app) is unaffected by this because nothing leaves the app's window.

Constraints:

- Free tier (Supabase Free, Cloudflare Workers Free, Brevo Free 300 emails/day).
- Brevo sender `no-reply@tourenbuddy.ch` and DNS records (SPF/DKIM/DMARC) already live — reused unchanged.
- Existing locale propagation (`user_metadata.locale`, `toEmailLocale`, `setLocale → updateUser`) stays. Only the email content and the post-email UX change.
- Send Email Hook payload includes `email_data.token` (the 6-digit OTP) for OTP flows, regardless of whether `emailRedirectTo` is set, so the Worker can switch to OTP without changes to Supabase config beyond the Redirect URLs cleanup.

## Goals / Non-Goals

**Goals:**

- Restore email OTP code entry as the sole auth method.
- Keep locale-aware email delivery introduced by #78.
- Reuse the existing Cloudflare Worker (no redeploy of new infra) — only template selection and parameter mapping change.
- Hard-cut: no parallel magic link path.

**Non-Goals:**

- Password auth, OAuth, SMS 2FA.
- Hybrid (link + code in same email) — see decision D2.
- Changing the locale store, i18n spec, or the user_metadata locale write paths from #78.
- Replacing Brevo / Supabase / Cloudflare.

## Decisions

### D1. OTP via Supabase `signInWithOtp` without `emailRedirectTo`

Drop `emailRedirectTo` from the call. Supabase then issues a 6-digit OTP code in the email payload (`email_data.token`) and expects it to be redeemed via `verifyOtp({ email, token, type: 'email' })`. This is the same call we used pre-#78.

**Alternatives:** keep `emailRedirectTo` and rely on the user typing the code anyway — works but leaves a dead magic link in the email body that confuses users and triggers the PWA problem the moment anyone clicks it. Reject.

### D2. Pure OTP, no hybrid email

We considered including both the OTP code and a magic link in the same email (user picks). Rejected because: cognitive load (user must decide), email looks phishy with both a CTA link and a "do not share this code" warning, link still hits the PWA problem and is therefore a foot-gun, support burden ("do I click or type?"), and double the QA surface for no fully-solved scenario.

### D3. Reuse existing Worker, swap template + params

The Send Email Hook payload contains `email_data.token` (6-digit OTP) on OTP requests. Worker change is small:

- Before: `params: { magic_link, email }`, template `BREVO_TEMPLATE_EN` / `_DE` → `magic_link_*`.
- After: `params: { otp, email }`, same secret names → new `otp_en` / `otp_de` template IDs.

The `auth-email-hook` capability spec changes accordingly (template selection input + params shape). HMAC verification, locale resolution, error handling are unchanged.

**Alternatives:**

- Disable the Send Email Hook and fall back to Supabase's default English OTP template. Rejected — loses the i18n investment and regresses German users.
- New Worker route per email type. Overkill; hook only handles OTP/magic-link mail and we are removing magic link.

### D4. Restore `verify-otp-page.vue` and remove magic link UI

- Re-add `src/features/auth/presentation/pages/verify-otp-page.vue` with a numeric 6-digit input (`inputmode="numeric"`, `autocomplete="one-time-code"`), submit calls `verifyOtp(email, code)`, resend calls `sendEmailOtp(email)`.
- Delete `callback-page.vue` and `check-email-page.vue`.
- Email entry page navigates to `/auth/verify-otp?email=…` on submit.
- Auth store: rename `sendMagicLink` → `sendEmailOtp`; add `verifyOtp` action; remove anything callback-specific.

### D5. Router cleanup

- Remove `/auth/callback` and `/auth/check-email` routes.
- Add `/auth/verify-otp` route, `redirectIfAuth` meta on (consistent with other `/auth/*` pages).
- Router guard simplifies — no more "callback always reachable" exemption.

### D6. Locale propagation untouched

`toEmailLocale`, `signInWithOtp({ ..., options: { data: { locale } } })`, and the `setLocale → updateUser` fire-and-forget call all stay. Locale is still merged into `user_metadata` at first sign-in and updated on every language change. The Worker reads it the same way.

### D7. Cutover ordering

Frontend and Worker template IDs must change in lockstep, otherwise:

- Frontend on OTP, Worker still on magic link → user gets a link mail but the app shows an OTP input. Broken.
- Frontend on magic link, Worker on OTP → user gets a code mail but the app shows the check-email screen waiting for a click. Broken.

Mitigation: deploy Worker secrets (new template IDs) first, then deploy frontend. The Worker switch is a Wrangler secret update — instant, no Worker redeploy needed if we keep secret names.

### D8. Hard-cut, no fallback

Per user instruction. Anyone with an in-flight magic link can still click it during the brief window between Worker secret swap and frontend deploy if we miss-order — they would land on `/auth/callback` which no longer exists. Acceptable: the route 404s, user re-requests an OTP. Document in tasks.

## Risks / Trade-offs

- **Cutover skew breaks auth for active users** → Mitigation: deploy Worker secret change immediately before frontend deploy; keep both deploys gated behind the same merge; smoke test in staging Supabase project first.
- **Pre-existing users reading old "click the link" mails** → Acceptable: short window; old links still verify via Supabase's `/auth/v1/verify` endpoint (Supabase still hosts that route) and produce a session in the browser, which the user can then re-attempt in the PWA. Worst case they re-request and get a code.
- **Mistyped OTP regresses UX** → Mitigation: numeric `inputmode`, `autocomplete="one-time-code"` (iOS/Android keyboard surfaces the code from the SMS/email), clear error messaging, resend button, no rate-limit surprises (Supabase default 1/min is fine).
- **`auth-email-hook` spec drift** → Update both the spec and the Worker tests in this change so they stay coupled.
- **Old magic link Brevo templates linger** → Cosmetic only; can be deleted from Brevo after deploy verification.

## Migration Plan

1. Land Worker test + frontend changes in a single PR. Worker code itself changes (template selection/params), but no infra (URL, secrets names) moves.
2. Pre-merge manual ops:
   - Brevo: create `otp_en` and `otp_de` templates (subject "Your TourenBuddy sign-in code" / "Dein TourenBuddy-Anmeldecode", body with `{{ params.otp }}` in a large monospace block, "do not share this code, valid for 1 hour" warning, footer with `{{ params.email }}`).
   - Cloudflare: `wrangler secret put BREVO_TEMPLATE_EN` (paste new OTP-EN ID), same for `_DE`.
3. Deploy Worker (`wrangler deploy` from `services/email-hook/`) — picks up new template IDs and the new params payload.
4. Deploy frontend (Cloudflare Pages auto on merge to `main`).
5. Supabase Dashboard: remove `/auth/callback` from the Redirect URLs allowlist (cosmetic; nothing breaks if left).
6. Smoke test EN + DE: request code, verify mail arrives in correct language, type code into `/auth/verify-otp`, land on `/map`.
7. Rollback: revert frontend PR + revert Worker secrets to the magic link template IDs (we keep them noted in 1Password / Bitwarden until step 8).
8. After 1 week of stable production, retire the `magic_link_en` / `magic_link_de` Brevo templates.

## Open Questions

- Should we keep the existing `verify-otp-page.test.ts` and `auth-store.test.ts` test shapes from before #78 (recoverable from `git log`) or write fresh? Recommend fresh — it is faster than rebasing pre-#78 tests through the locale-aware changes.
- OTP code length: Supabase default is 6 digits; pre-#78 we used 8. Default to 6 (Supabase current default; matches `autocomplete="one-time-code"` heuristics best).
