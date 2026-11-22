# Tasks

## 1. Database

- [x] 1.1 Migration `terms_acceptances`: table, RLS, grants, `terms_current_version`, `terms_status`, `accept_terms`, `terms_enforced` (false), `require_terms`/`terms_ok`, triggers on every `public` base table, bucket policies, `auth.users` delete trigger, `pg_cron` purge
- [x] 1.2 pgTAP `terms_acceptance.sql`: accept and mismatch, no direct writes, enforcement off and on (direct write, definer RPC, storage), service-role and no-user writes pass, reads and deletes pass, every table has the trigger, deletion marks retention, purge and backstop
- [ ] 1.3 Migration `terms_enforcement_on` (step 2 of the rollout, separate PR; SQL in design, Rollout)

## 2. PWA

- [x] 2.1 `features/terms`: domain `termsGate`, repository (status, accept), store
- [x] 2.2 `/terms` page with the native wording, states and actions; locales (EN, DE)
- [x] 2.3 Router guard and bootstrap: status before the first navigation, push only on `pass`
- [x] 2.4 Replay: `terms_not_accepted` waits
- [x] 2.5 Tests; `npx eslint . --fix`, `npm run test`, `npm run type-check`
