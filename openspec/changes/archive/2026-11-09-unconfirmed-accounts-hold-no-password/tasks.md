# Tasks

## 1. Database

- [x] 1.1 Migration `20261108120000_unconfirmed_accounts_hold_no_password.sql`: trigger function (search path pinned, closed to client roles, granted to `supabase_auth_admin`) and the trigger
- [x] 1.2 pgTAP `supabase/tests/unconfirmed_password.sql`: insert and update of an unconfirmed account drop the password, confirming restores none, confirmed and phone-confirmed accounts keep theirs, seeded demo users keep theirs, function grants (verified against the local stack in a rolled-back transaction: 8/8, and 1–3 fail without the migration)
- [x] 1.3 One-time `update` in the migration emptying every existing password (verified against the local stack in a rolled-back transaction: a confirmed user inserted with a password before the migration holds none after it)

## 2. Settings

- [x] 2.1 `config.toml`: `enable_confirmations = true`, `minimum_password_length = 8`, `[auth.passkey]`, `[auth.webauthn]`

## 3. Owner

- [x] 3.1 `supabase db reset && supabase test db` locally; sign in with a code in the PWA (new and seeded address)
- [x] 3.2 Hosted, as soon as merged: the audit query (design) and a look at the list, then `supabase db push` and Confirm email on together, then the other dashboard settings (proposal, Impact); a new address can still sign in to the PWA with a code
