# Proposal

## Why

The native apps (`sekael/tourenbuddy-native`, epic #346) need backend support before they can ship
(Phase 2, #369): push to iOS and Android devices, account deletion (an App Store and Play blocker),
an operator alert for abuse reports (App Review guideline 1.2) and CORS for the new web origins.
Everything here is additive: the live PWA keeps working unchanged.

The owner asked (2026-11-09) to propose and implement Phases 2 to 4 together, with an independent
reviewer standing in for per-proposal approval, as for Phase 1.

## What Changes

- **B1 Native push.** New table `device_push_tokens` (one row per device token: platform, app id,
  APNs environment, app version), own-row read and delete, writes only through the definer RPC
  `register_device_push_token`, last registrant owns a token. The Worker's push fan-out sends to
  native tokens next to the PWA's Web Push subscriptions: **APNs directly** for iOS (token auth,
  ES256 JWT signed with WebCrypto) and **FCM HTTP v1** for Android (service-account RS256 JWT,
  cached access token). A token APNs or FCM reports as gone deletes its row. Payload: title, body
  and `url` (`<APP_URL>/?notification=<id>`), as today.
- **B2 Account deletion.** New authenticated Worker route `POST /account/delete`: verifies the JWT,
  deletes the caller's Storage objects under `<uid>/` in `tour-gpx` and `tour-attachments`, then
  the auth user. Foreign keys already cascade every row and anonymize `abuse_reports`; a pgTAP
  suite proves it, and proves that deletion emits no notification to anyone. The PWA gets a
  "Delete account" action in the profile sheet (the native app has its own).
- **B6 Moderation.** An insert or repeat of an `abuse_reports` row alerts the operator: an AFTER
  trigger hands the report to the Worker (pg_net, the same Vault URL and secret as notifications),
  which emails `MODERATION_EMAIL` with both accounts and the reason. Response target and process in
  `docs/moderation.md`. The "no notification to moderators" rule of `user-blocks` is replaced.
- **B7 CORS.** The native web app's origins (`tourenbuddy-native.pages.dev` and its previews,
  Expo's dev server) join `ALLOWED_ORIGINS`. Native clients send no `Origin`: they get no CORS
  headers and keep working on the JWT (tested for `/calendar/sync` and `/account/delete`).
- **B5 Version policy.** The expand-then-contract rule for RPCs and tables joins `AGENTS.md` and
  `.claude/conventions.md`. `app-config.json` itself is published by the native app's web project
  (it serves `tourenbuddy.ch`).
- **B8 Known data gap.** Reviewed in `design.md` (D7): the exposure does not change with native
  clients; the fix is a follow-up, recorded with its shape.

Out of this change: B3 legal pages and the public `/account-deletion` page are static pages of the
native repo's web project (`public/`, served on `tourenbuddy.ch`); B4's association files live
there too. B9 is Phase 7.

## Capabilities

### New Capabilities

- `account-deletion`: delete one's own account with all data and files, silently.

### Modified Capabilities

- `notifications`: native device tokens and their delivery, next to Web Push.
- `user-blocks`: abuse reports alert the operator.

## Impact

- Migrations: `device_push_tokens` (+ RPC), `abuse_report_alert` (trigger). pgTAP:
  `native_push_tokens.sql`, `account_deletion.sql`, `abuse_report_alert.sql`.
- Worker: `native-push.ts` (APNs, FCM), `account.ts` (`/account/delete`), `moderation.ts`
  (`/moderation/report`), `push.ts` fan-out, `config.ts` (secrets, origins). Tests for each.
- New Worker secrets: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `FCM_SERVICE_ACCOUNT`,
  `MODERATION_EMAIL`. Unset secrets switch the channel off, never fail the event.
- PWA: profile sheet "Delete account" (+ locales, tests).
- Docs: `SETUP-NOTIFICATIONS.md`, `docs/notifications.md`, `docs/moderation.md`, `AGENTS.md`,
  `.claude/conventions.md`, `.claude/architecture.md`.
- Deploy: `supabase db push` (prompted), then `cd services/email-hook && npx wrangler deploy`
  after the new secrets are set. Order matters only for the alert trigger, which stays silent
  until the Worker knows `/moderation/report` (it answers 404 and the report stays committed).
