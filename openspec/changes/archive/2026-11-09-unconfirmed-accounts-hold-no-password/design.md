# Design

## Decisions

- **A trigger, on insert and on password updates.** `before insert or update of encrypted_password
  on auth.users`: when the row has neither `email_confirmed_at` nor `phone_confirmed_at`, the
  password becomes `''` (GoTrue's "no password": `Authenticate` refuses it, `HasPassword` is
  false). The rule needs no notion of "creation": every legitimate password is set on a confirmed
  row, and `/signup` creates an unconfirmed one. GoTrue's `/signup` never updates an existing
  unconfirmed user ("we can't be sure of their claimed identity"); the update branch is the same
  rule, not a known path. Confirming (an update of `email_confirmed_at` only) does not fire it and
  finds no password to keep.
- **Not the `before-user-created` auth hook.** Its payload does not say whether a password was
  given, and it does not run on updates.
- **Grants.** The function is closed to `public`, `anon` and `authenticated` (the security-hardening
  default) and granted to `supabase_auth_admin`, the role GoTrue writes `auth.users` as. A trigger
  is not an `ALTER TABLE` on the Supabase-owned table.
- **Existing passwords dropped in the migration.** The trigger guards writes from now on; the rows
  `/signup` created while confirmations were off are confirmed and would keep their passwords. One
  `update` in the same migration empties every password, so it reaches the hosted project in the
  same `db push` as the trigger. No exceptions: no flow uses a password before the native app, and
  every account signs in with a code. Locally `supabase db reset` runs it before the seed, so the
  seeded demo users keep theirs; `supabase migration up` on an existing local database drops them
  too (they sign in with the test code anyway; a reset brings them back).
- **Audit, before the hosted `db push`** (read-only, in the dashboard's SQL editor): who holds a
  password, and whether they ever signed in. An account the owner does not recognize, created with
  a password and never confirmed by a code, is someone else's `/signup`; the migration takes its
  password, and the owner decides about the account itself (for example delete it if its address
  never used the app).

  ```sql
  select id, email, created_at, email_confirmed_at, last_sign_in_at,
         raw_app_meta_data ->> 'provider' as provider
    from auth.users
   where coalesce(encrypted_password, '') <> ''
   order by created_at;
  ```
- **Confirmations on.** Without them, `/signup` answers with a session for any address, which the
  trigger cannot help with. Code sign-ins already confirm a new address by the code.

## Risks / Trade-offs

- [A Supabase upgrade writes passwords some other way] → The pgTAP suite pins the observable rule
  on `auth.users`; GoTrue writes passwords only through this column.
- [The dashboard's "Create user" without "Auto confirm"] → That user gets no password and signs in
  with a code. Intended.
- [The phone exemption] → A confirmed phone keeps a password. It matters only if phone sign-up with
  a password is ever enabled (it is not: phone numbers are added to signed-in accounts and
  verified); revisit the rule then.
