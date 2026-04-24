## 1. Branch + scaffolding

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/78-magic-link-auth`
- [x] 1.2 Create `services/email-hook/` directory at repo root with its own `package.json` (Wrangler), `tsconfig.json`, `wrangler.toml` (no secrets committed), `src/index.ts`, and a `README.md` referencing this change folder.

## 2. Locale normalization helper (i18n spec)

- [x] 2.1 Add `toEmailLocale(code: string): 'en' | 'de'` in `src/core/i18n/` (or wherever locale registry lives). `de-CH` → `de`, `en` → `en`, otherwise → `en`.
- [x] 2.2 Unit test in `test/core/i18n/to-email-locale.test.ts` covering all supported codes plus an unknown input.

## 3. Auth store + pages (auth spec)

- [x] 3.1 In `src/features/auth/presentation/stores/auth-store.ts`: rename `sendEmailOtp` → `sendMagicLink(email)`. Internally call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${window.location.origin}/auth/callback\`, data: { locale: toEmailLocale(useLocaleStore().currentLocale) } } })`. Remove `verifyOtp` action.
- [x] 3.2 Delete `src/features/auth/presentation/pages/verify-otp-page.vue`.
- [x] 3.3 Add `src/features/auth/presentation/pages/check-email-page.vue`: title, subtitle that includes the email, resend button (calls `sendMagicLink` with same email), back button. No input field.
- [x] 3.4 Add `src/features/auth/presentation/pages/callback-page.vue`: shows localized loading state; subscribes to `onAuthStateChange`; on `SIGNED_IN` redirects to `/map` (or `/onboarding` per existing profile rules); reads `?error_description` and shows a localized error with a "back to email entry" button.
- [x] 3.5 Update `src/features/auth/presentation/pages/email-entry-page.vue` to navigate to `{ name: 'check-email', query: { email } }` and to call `sendMagicLink` instead of `sendEmailOtp`.
- [x] 3.6 In `src/app/router/index.ts`: replace `verify-otp` route with `check-email` (`/auth/check-email`), add `callback` (`/auth/callback`) WITHOUT `redirectIfAuth` meta so it can run while becoming authenticated. Update guards if needed to allow `/auth/callback` for everyone.

## 4. Profile language sync (user-profile spec)

- [x] 4.1 In `useLocaleStore().setLocale` (or its consumer in the profile selector if cleaner): after successful local apply, when `useAuthStore().isAuthenticated` is true, fire-and-forget `supabase.auth.updateUser({ data: { locale: toEmailLocale(code) } })`. Log errors via `useLogger`. Do not surface to user.
- [x] 4.2 Verify the language selector flow in `src/features/user/presentation/...` profile view triggers exactly one `updateUser` call per change.

## 5. Locales (i18n catalogs)

- [x] 5.1 Add new keys under `auth.checkEmail.*` (`title`, `subtitlePrefix`, `resendBtn`, `resendSuccess`, `resendError`, `backBtn`) in `src/locales/en.json` and `src/locales/de-CH.json`.
- [x] 5.2 Add new keys under `auth.callback.*` (`loading`, `errorTitle`, `errorBody`, `backToEmailBtn`) in both locale files.
- [x] 5.3 Remove `auth.verifyOtp.*` keys from both locale files.
- [x] 5.4 Run the locale parity check (existing CI script) to confirm no missing keys.

## 6. Frontend tests

- [x] 6.1 Update `test/features/auth/presentation/stores/auth-store.test.ts`: drop `verifyOtp` tests, add `sendMagicLink` tests asserting the `signInWithOtp` call shape (email, `emailRedirectTo`, `options.data.locale` for both `en` and `de-CH` active locales).
- [x] 6.2 Add `test/features/auth/presentation/pages/callback-page.test.ts`: mocks `onAuthStateChange`, asserts redirect to `/map` on `SIGNED_IN` and error rendering on `?error_description=...`.
- [x] 6.3 Add `test/features/auth/presentation/pages/check-email-page.test.ts`: clicking resend triggers store `sendMagicLink`; success/error states render.
- [x] 6.4 Update `test/features/user/presentation/stores/user-profile-store.test.ts` (or wherever locale store is tested) to assert `updateUser` is called when authenticated and NOT called when unauthenticated.

## 7. Cloudflare Worker (auth-email-hook spec)

- [x] 7.1 In `services/email-hook/package.json`: add `wrangler` and `standardwebhooks` as devDependencies/dependencies as appropriate. Add `deploy`, `dev` scripts.
- [x] 7.2 In `services/email-hook/src/index.ts`: implement `fetch` handler that
  - reads `webhook-id`, `webhook-timestamp`, `webhook-signature` headers,
  - verifies via `standardwebhooks` with `SEND_EMAIL_HOOK_SECRET`,
  - parses payload, picks `BREVO_TEMPLATE_DE` if `user.user_metadata.locale === 'de'` else `BREVO_TEMPLATE_EN`,
  - constructs `magic_link = ${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`,
  - POSTs to `https://api.brevo.com/v3/smtp/email` with `api-key: BREVO_API_KEY` and body `{ to: [{ email }], templateId, params: { magic_link, email } }`,
  - returns 200 on Brevo 2xx, 502 on Brevo error, 401 on bad signature, 500 on missing config.
- [x] 7.3 Add minimal vitest in `services/email-hook/test/index.test.ts` mocking `fetch` and the webhook verifier; cover signature pass/fail, locale en/de/unknown, Brevo success/error.
- [x] 7.4 Document required Wrangler commands in `services/email-hook/README.md`:
  - `wrangler secret put BREVO_API_KEY`
  - `wrangler secret put SEND_EMAIL_HOOK_SECRET`
  - `wrangler secret put BREVO_TEMPLATE_EN`
  - `wrangler secret put BREVO_TEMPLATE_DE`
  - `wrangler deploy`

## 8. External provider setup (manual — pre-deploy)

> Pre-existing: `tourenbuddy.ch` DNS managed in Cloudflare; Brevo sender `no-reply@tourenbuddy.ch` already verified with SPF/DKIM/DMARC live (used today for OTP). Skip domain auth — only verify still green before launch.

- [ ] 8.1 **Cloudflare DNS sanity check**: confirm existing SPF, Brevo DKIM CNAMEs, and DMARC records on `tourenbuddy.ch` are still present and unchanged. No new records required.
- [x] 8.2 **Brevo sender re-check**: in Brevo dashboard confirm `no-reply@tourenbuddy.ch` and the `tourenbuddy.ch` domain still show "Authenticated" (green). No new sender setup.
- [x] 8.3 **Brevo templates**: create transactional template `magic_link_en` (subject "Your TourenBuddy sign-in link", HTML + plaintext, primary CTA `{{ params.magic_link }}`, footer with `{{ params.email }}`, sender `no-reply@tourenbuddy.ch`). Note its numeric `templateId`.
- [x] 8.4 **Brevo templates**: create `magic_link_de` (subject "Dein TourenBuddy-Anmeldelink", same parameters and sender). Note its `templateId`.
- [x] 8.5 **Brevo API key**: reuse the existing transactional API key if it has `transactional:send` scope; otherwise create a new transactional-only key. Store securely for 8.7.
- [x] 8.6 **Cloudflare Worker deploy**: from `services/email-hook/`, run `wrangler login`, then `wrangler deploy`. Note the production Worker URL.
- [x] 8.7 **Cloudflare secrets**: `wrangler secret put BREVO_API_KEY` (paste 8.5 key), `wrangler secret put BREVO_TEMPLATE_EN` (paste 8.3 ID), `wrangler secret put BREVO_TEMPLATE_DE` (paste 8.4 ID), `wrangler secret put SEND_EMAIL_HOOK_SECRET` (generate a random 32-byte base64 string; save it for 8.8). Set `SUPABASE_URL` in `wrangler.toml` `[vars]` (non-secret).
- [x] 8.8 **Supabase Dashboard → Auth → Hooks**: enable "Send Email Hook", set URL = Worker URL from 8.6, paste the same secret from 8.7. Save. (This replaces the current path that has Supabase send OTP via Brevo SMTP — confirm with stakeholder before flipping.)
- [x] 8.9 **Supabase Dashboard → Auth → URL Configuration**: ensure `https://app.tourenbuddy.ch/auth/callback` (and any Cloudflare Pages preview URLs needed) are added to "Redirect URLs" allowlist.
- [ ] 8.10 **End-to-end smoke test**: request a magic link in EN locale, click it, verify session lands on `/map`. Repeat in DE locale, verifying the email body language and that the email arrived from `no-reply@tourenbuddy.ch`.

## 9. Quality gates + handoff

- [x] 9.1 `npx eslint . --fix` (zero warnings)
- [x] 9.2 `npm run format`
- [x] 9.3 `npm run type-check`
- [x] 9.4 `npm run test` (all green)
- [x] 9.5 Self-review diff for unused imports, dead code from removed OTP page, leftover `verifyOtp` references.
- [ ] 9.6 Prompt user to commit (do NOT run `git commit`). Suggested message:
      `feat(auth): switch from email OTP to magic link with i18n templates (#78)`
- [ ] 9.7 Open PR closing #78. Include in description: link to this OpenSpec change, list of manual provider steps from §8 that must be done before merge, and DNS-propagation caveat.
- [ ] 9.8 After merge + production deploy verified, run `openspec archive switch-to-magic-link-auth` (via the `opsx:archive` skill).
