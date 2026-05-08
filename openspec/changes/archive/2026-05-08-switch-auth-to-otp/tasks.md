## 1. Git setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/switch-auth-to-otp` (replace with `feat/<issue-number>-switch-auth-to-otp` once an issue is filed)

## 2. Auth store + pages (auth spec)

- [x] 2.1 In `src/features/auth/presentation/stores/auth-store.ts`: rename `sendMagicLink(email)` → `sendEmailOtp(email)`. Drop `emailRedirectTo` from the `signInWithOtp` call; keep `options.data.locale = toEmailLocale(useLocaleStore().currentLocale)`.
- [x] 2.2 Add `verifyOtp(email, token)` action calling `supabase.auth.verifyOtp({ email, token, type: 'email' })`; expose Supabase errors to the caller, do not throw past the store boundary.
- [x] 2.3 Add `src/features/auth/presentation/pages/verify-otp-page.vue`: title, subtitle including the recipient email, a single 6-digit numeric input (`inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`), verify button (calls `verifyOtp`), resend button (calls `sendEmailOtp(email)` with success/error feedback), back button (navigates to `/auth/email`). On successful verify the page does nothing further — `onAuthStateChange` + the router guard handle the redirect.
- [x] 2.4 Update `src/features/auth/presentation/pages/email-entry-page.vue` to call `sendEmailOtp` and navigate to `{ name: 'verify-otp', query: { email } }` on success.
- [x] 2.5 Delete `src/features/auth/presentation/pages/callback-page.vue`.
- [x] 2.6 Delete `src/features/auth/presentation/pages/check-email-page.vue`.
- [x] 2.7 In `src/app/router/index.ts`: remove `/auth/callback` and `/auth/check-email` routes; add `/auth/verify-otp` (route name `verify-otp`) with the `redirectIfAuth` meta consistent with other `/auth/*` pages; remove the special "callback always reachable" branch from the navigation guard.
- [x] 2.8 Grep the codebase for any remaining references to `sendMagicLink`, `callback-page`, `check-email`, `/auth/callback`, `/auth/check-email`, `emailRedirectTo`. Remove or update each.

## 3. Locales (i18n catalogs)

- [x] 3.1 Add new keys under `auth.verifyOtp.*` (`title`, `subtitlePrefix`, `inputLabel`, `inputPlaceholder`, `verifyBtn`, `verifyError`, `resendBtn`, `resendSuccess`, `resendError`, `backBtn`) in `src/locales/en.json` and `src/locales/de-CH.json`.
- [x] 3.2 Remove `auth.checkEmail.*` and `auth.callback.*` keys from both locale files.
- [x] 3.3 Confirm locale parity (the existing CI check is the authority).

## 4. Frontend tests

- [x] 4.1 Update `test/features/auth/presentation/stores/auth-store.test.ts`: drop `sendMagicLink` tests; add `sendEmailOtp` tests asserting `signInWithOtp` is called with `{ email, options: { data: { locale } } }` (no `emailRedirectTo`) for both `en` and `de-CH` active locales; add `verifyOtp` tests covering success and Supabase-error propagation.
- [x] 4.2 Add `test/features/auth/presentation/pages/verify-otp-page.test.ts`: typing a 6-digit code and clicking verify calls `verifyOtp`; failed verify renders the localized error and clears the input; resend triggers `sendEmailOtp`; back button navigates to `/auth/email`.
- [x] 4.3 Delete `test/features/auth/presentation/pages/callback-page.test.ts` and `test/features/auth/presentation/pages/check-email-page.test.ts`.
- [x] 4.4 Update `test/app/router/...` (or wherever the guard is tested) to reflect the removed callback exemption.

## 5. Cloudflare Worker (auth-email-hook spec)

- [x] 5.1 In `services/email-hook/src/index.ts`: remove the magic link URL composition (`${SUPABASE_URL}/auth/v1/verify?token=...`). Read `email_data.token` and pass it to Brevo as `params.otp`. If `email_data.token` is missing or empty, return HTTP 400 without calling Brevo.
- [x] 5.2 Replace the Brevo request body's `params: { magic_link, email }` with `params: { otp, email }`. Template selection logic and HMAC verification stay unchanged.
- [x] 5.3 Remove `SUPABASE_URL` from `services/email-hook/wrangler.toml` `[vars]` if no other code path uses it.
- [x] 5.4 Update `services/email-hook/test/index.test.ts`: drop magic link URL assertions; add tests for OTP forwarding (verbatim 6-digit string), missing-token 400 response, locale en/de selection still works with the new params shape.
- [x] 5.5 Update `services/email-hook/README.md`: document the new `params.otp` contract; note that `BREVO_TEMPLATE_EN` / `BREVO_TEMPLATE_DE` now reference OTP templates, not magic link templates.

## 6. External provider setup (manual — pre-deploy)

> Pre-existing: `tourenbuddy.ch` DNS, Brevo sender `no-reply@tourenbuddy.ch`, Cloudflare Worker, Supabase Send Email Hook all stay as-is. Only template content and the secrets pointing at templates change.

- [x] 6.1 **Brevo template `otp_en`**: create a transactional template with subject "Your TourenBuddy sign-in code", body containing `{{ params.otp }}` in a large monospace block, a "Do not share this code. It expires in 1 hour." warning, and a footer mentioning `{{ params.email }}`. Sender `no-reply@tourenbuddy.ch`. Note its numeric `templateId`.
- [x] 6.2 **Brevo template `otp_de`**: same with subject "Dein TourenBuddy-Anmeldecode" and German body copy. Note its `templateId`.
- [x] 6.3 **Cloudflare Worker secrets**: from `services/email-hook/`, run `wrangler secret put BREVO_TEMPLATE_EN` (paste 6.1 ID) and `wrangler secret put BREVO_TEMPLATE_DE` (paste 6.2 ID). Save the previous (magic link) template IDs in 1Password / Bitwarden as the rollback target.
- [x] 6.4 **Cloudflare Worker deploy**: `wrangler deploy` from `services/email-hook/` to ship the new params payload and removed URL composition.
- [x] 6.5 **Supabase Dashboard → Auth → URL Configuration**: remove `https://app.tourenbuddy.ch/auth/callback` from the "Redirect URLs" allowlist. Leave the Send Email Hook config untouched.
- [x] 6.6 **Staging smoke test (before merging the frontend PR)**: in a staging Supabase project pointing at the same Worker, request an OTP in EN, verify the mail arrives with the 6-digit code in English; repeat in DE. Verify HTTP 400 path by replaying a hook payload with `email_data.token` blanked (manual `curl` with valid HMAC against the staging Worker).

## 7. Finalize

- [x] 7.1 `npx eslint . --fix` (zero warnings)
- [x] 7.2 `npm run type-check`
- [x] 7.3 `npm run test` (all green, both root and `services/email-hook/`)
- [x] 7.4 Self-review the diff: no leftover `sendMagicLink` / `callback` / `check-email` references, no orphan locale keys, no orphan tests, no `emailRedirectTo` anywhere in `src/`.
- [x] 7.5 Prompt user to commit (do NOT run `git commit`). Suggested message:
      `feat(auth)!: switch from magic link back to email OTP for PWA support`
      Body should mention the Worker template swap and the manual Supabase Redirect URL cleanup so the deployer remembers them.
- [x] 7.6 Prompt user to push and open a PR. PR description SHOULD include: link to this OpenSpec change, the §6 manual ops checklist that must complete before merge to main, and a one-line cutover note ("deploy Worker first via 6.4, then merge frontend").
- [x] 7.7 After merge + production verified (request OTP in EN and DE, sign in successfully on installed PWA on iOS and Android), run the `opsx:archive` skill to archive `switch-auth-to-otp`.
