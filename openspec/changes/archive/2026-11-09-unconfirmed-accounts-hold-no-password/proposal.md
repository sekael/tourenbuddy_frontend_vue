# Proposal

## Why

Supabase's `/signup` endpoint takes an email address and a password from anyone holding the public
anon key, whatever this app does. With email confirmations off (today), it hands out a session at
once for an address nobody proved. With confirmations on, the account stays unusable until the
address is confirmed, but its owner confirms it simply by signing in with an email code, and the
password a stranger gave it would then sign in to their account.

The native app (`sekael/tourenbuddy-native`, `add-auth-session`) adds password sign-in and passkeys
on this backend. Its owner decided (2026-11-08) to close the gap here, before the hosted settings
change and before any native build with password screens reaches testers.

## What Changes

- **An account without a confirmed email or phone never holds a password:** a trigger on
  `auth.users` empties `encrypted_password` on insert and on password updates of such rows.
  Confirming the address later brings nothing back. Every legitimate password is set on a confirmed
  account (the native app sets it after the code; the seed's demo users and the dashboard's users
  are confirmed), so nothing else changes.
- **Passwords that already exist are dropped, once, in the same migration.** With confirmations off,
  `/signup` created accounts confirmed on the spot, so the trigger lets them pass. No client has
  ever set a password (the PWA signs in with a code; its `updateUser` calls change the phone and
  the locale), so each existing password came from `/signup` or the dashboard. All of them go, no
  exceptions: those accounts, the owner's included, keep signing in with a code, the PWA's normal
  flow, and can set a password in the native app's Profile later.
- **Audit first:** before the migration goes to the hosted project, the owner lists the accounts
  that hold a password, to see whether anyone used `/signup` (design, "Audit").
- **Auth settings (`config.toml`, then the hosted dashboard):** email confirmations on, minimum
  password length 8, passkeys on with the relying party `tourenbuddy.ch` (origins
  `https://tourenbuddy.ch`, `https://test.tourenbuddy.ch`) for the native iOS app's Face ID
  sign-in.

The PWA keeps its code sign-in unchanged: a code confirms a new address by itself, and the email hook
already sends a code for every email type.

## Capabilities

### Modified Capabilities

- `auth`: unconfirmed accounts hold no password.

## Impact

- New migration `20261108120000_unconfirmed_accounts_hold_no_password.sql` and pgTAP suite
  `supabase/tests/unconfirmed_password.sql`.
- `supabase/config.toml`: `[auth] minimum_password_length`, `[auth.email] enable_confirmations`,
  `[auth.passkey]`, `[auth.webauthn]`. Restart the local stack.
- Hosted project, as soon as this is merged (it fixes the live backend; nothing waits for the
  native app): the audit query, then `supabase db push` (the migration) and, right after, the dashboard's Sign In /
  Providers → Email → Confirm email on. The trigger alone protects nothing while `/signup` confirms
  every address on its own. Then minimum password length 8 and Passkeys on, with the relying party
  above. The PWA verifies codes as type `email`, which also redeems confirmation codes.
