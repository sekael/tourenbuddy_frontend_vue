# Tasks

## 1. Git Setup

- [x] 1.1 Create `feat/369-native-backend` from `origin/main` (no ssh for `git fetch` in the container)

## 2. Database

- [x] 2.1 Migration `device_push_tokens`: table, own-row select/delete RLS, grants, `register_device_push_token` (definer, validation, last registrant owns)
- [x] 2.2 Migration: `account_storage_objects(uid)` (definer, `service_role` only)
- [x] 2.3 Migration `abuse_report_alert`: `fn_dispatch_abuse_report` + AFTER INSERT OR UPDATE trigger
- [x] 2.4 pgTAP: `native_push_tokens.sql`, `account_deletion.sql` (cascade, anonymized reports, no notifications), `abuse_report_alert.sql`

## 3. Worker

- [x] 3.1 `native-push.ts`: APNs (ES256 JWT, host by environment) and FCM HTTP v1 (RS256 grant, cached token), stale-token deletion
- [x] 3.2 `push.ts`: fan out to Web Push and native tokens
- [x] 3.3 `account.ts`: `POST /account/delete` (JWT, storage objects, auth user)
- [x] 3.4 `moderation.ts`: `POST /moderation/report` (secret, lookups, Brevo email)
- [x] 3.5 `config.ts`: new secrets, CORS origins; `index.ts` routes
- [x] 3.6 Tests: APNs/FCM requests and stale handling, missing secrets, deletion order and failures, no-Origin requests, moderation secret

## 4. PWA

- [x] 4.1 Profile sheet "Delete account" with confirmation dialog; repository call to the Worker; sign-out
- [x] 4.2 Locales (`en.json`, `de-CH.json`), `npm run check:locales`; tests for failure paths

## 5. Docs

- [x] 5.1 `SETUP-NOTIFICATIONS.md` (APNs key, FCM service account, moderation address), `docs/notifications.md`
- [x] 5.2 `docs/moderation.md` (process, 24-hour response target, filtering position)
- [x] 5.3 Expand-then-contract rule in `AGENTS.md` and `.claude/conventions.md`; B8 review note in `.claude/architecture.md`

## 6. Verify

- [x] 6.1 Migrations + pgTAP in a rolled-back transaction against the local stack; `cd services/email-hook && npm test`; `npx eslint . --fix`, `npm run test`, `npm run type-check`
- [x] 6.2 Independent review until satisfied
- [x] 6.3 Owner: `supabase db reset && supabase test db`, commit, PR, `supabase db push`, secrets, `npx wrangler deploy`, a push to a real iPhone
- [ ] 6.4 Owner, later (B4): set the Worker's `APP_URL` to `https://tourenbuddy.ch` once the native web app is live on the apex (Phase 7); until then email links keep opening the PWA on `test.tourenbuddy.ch`
- [ ] 6.5 Owner (B8): accept or reject the `tours_select_friend` deferral (design D7) before the store release (Phase 6)
