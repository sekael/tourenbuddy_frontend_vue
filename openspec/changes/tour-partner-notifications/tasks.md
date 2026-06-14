## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/210-tour-partner-notifications`

## 2. Audit & document notifications

- [x] 2.1 Audit all client dispatchers in `src/features/notifications/data/notify-dispatch.ts` and all Worker handlers in `services/email-hook/src/notify.ts` to enumerate every notification.
- [x] 2.2 Create `docs/notifications.md` with a table per notification: trigger, actor, recipients, `notif` type (`tour_updates` / `tour_interest` / friendship / link / group), push title+body (EN/DE), email template, mute key, client call site, Worker handler.
- [x] 2.3 Add a "Known gaps" section documenting that a **removed** partner receives no notification (Worker resolves recipients from the live row).

## 3. Client: pass newly-added partners

- [x] 3.1 In `notify-dispatch.ts`, add optional `newPartnerContactIds?: string[]` param to `notifyTourChanged` and include it in the POST body when present.
- [x] 3.2 In `tours-store.ts` `updateTour`, compute `addedPartnerIds = draft.partnerIds \ existing.partnerIds` and pass it to `notifyTourChanged(id, 'updated', addedPartnerIds)`. Empty/absent set must preserve current behavior.

## 4. Worker: split recipients in the `updated` branch

- [x] 4.1 In `handleTourChanged` (`services/email-hook/src/notify.ts`), read optional `newPartnerContactIds` from the body; in the `updated` branch resolve them via `resolveUsersByContactIds`, intersect with the resolved recipient set.
- [x] 4.2 Dispatch `created` to the newly-added subset and `updated` to the remainder (mutually exclusive — a new partner must receive exactly one notification).

## 5. Tests

- [x] 5.1 Unit test the client diff: adding a partner passes the correct `newPartnerContactIds`; an edit with no partner change passes none. Cover the failure/edge case (partner removed → not in added set). Run `npm run test`.
- [x] 5.2 Worker test (`services/email-hook/test/`, runs under its own vitest — verify with `cd services/email-hook && npm test`): `updated` with `newPartnerContactIds` routes new partners to `created` copy and pre-existing partners to `updated`; absent ids → all `updated` (regression guard).

## 6. Worker deploy

- [ ] 6.1 Deploy the updated Worker (NOT in CI): `cd services/email-hook && npx wrangler@latest deploy`. Without this, the client change runs against a stale Worker that ignores `newPartnerContactIds` (degrades to all-`updated`).

## 7. Finalize

- [x] 7.1 Root checks clean: `npx eslint . --fix && npm run type-check && npm run test`.
- [x] 7.2 Worker checks clean (separate vitest project, not covered by root `npm run test`): `cd services/email-hook && npm test`.
- [ ] 7.3 Prompt the user to commit with a ready-to-copy conventional commit message (e.g. `feat(notifications): greet newly-added tour partners as a shared tour (#210)` + a `docs:` commit for `docs/notifications.md`).
- [ ] 7.4 Prompt the user to push and open a PR to `main`.
