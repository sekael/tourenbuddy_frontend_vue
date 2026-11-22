# Design

Source: the native repository's `.review/legal/acceptance.md` (legal review PASS, 2026-11-22) and
its change `add-terms-acceptance`.

## D1. Record and version

- `terms_acceptances(id, user_id, email, version, accepted_at default now(), retain_until)`, no
  foreign key to `auth.users` (rows outlive the account). RLS: select own rows; no client insert,
  update or delete (no policy, no privilege).
- `terms_current_version()` (sql, immutable): `'2026-11-22'`. A terms change replaces it in a new
  migration, the same day as the PWA release and the new texts on tourenbuddy.ch (native design,
  Rollout).
- `terms_status()` (definer, authenticated): `current_version`, `accepted_version` (latest for
  `auth.uid()`).
- `accept_terms(p_version)` (definer, authenticated): `p_version` must equal the version in force,
  else `terms_version_mismatch`; inserts `auth.uid()`, the account's email from `auth.users` and
  `now()`; returns the status.

## D2. Enforcement: one trigger function, one switch

Tour, contact, suggestion, link and friendship writes go through SECURITY DEFINER RPCs, which
bypass RLS, so policies alone cannot gate them. A `BEFORE INSERT OR UPDATE` row trigger on every
base table in `public` (except `terms_acceptances`) calls `require_terms()`, which raises
`terms_not_accepted` (`P0001`) when all of these hold:

- the switch `terms_enforced()` returns true (ships `false`; a later migration replaces it),
- the request carries a user (`auth.uid()` is not null): service role, `pg_cron` and the auth
  server write with no user and pass,
- that user has no acceptance of the version in force.

Triggers fire inside definer RPCs and cascades too; a cascade runs as the acting user, who has
accepted (their own write passed first). The two buckets' INSERT and UPDATE policies on
`storage.objects` get `and public.terms_ok()` (the same check as a boolean that raises), recreated
with their existing conditions. Reads and deletes are never gated. A pgTAP test asserts every
`public` base table carries the trigger, so a new table can't slip past.

## D3. Retention

`after delete on auth.users` (precedent: `20261108120000`) sets `retain_until = now() + 10 years`
on that user's rows. `pg_cron` daily: delete rows past `retain_until`; backstop: mark rows whose
user no longer exists and whose `retain_until` is null.

## D4. PWA gate

A `terms` store (status, accept) and a `/terms` page. The router guard sends an authenticated user
whose gate is not `pass` to `/terms` before any other route, onboarding included; bootstrap loads
the status before the first navigation and subscribes to push only on `pass`. Same states, wording
and actions as native (`termsGate` table: update, pass, accept, unavailable). Links open the
website's pages (`https://tourenbuddy.ch/terms`, `/privacy`). The offline queue's replay treats
`terms_not_accepted` as waiting (entry kept, no attempt, drain stops).

## Rollout

1. Migration `terms_acceptances` (switch off) with this PWA release; the native iOS app with its
   gate. The web is this PWA (#346 D21): the native repository releases no web app.
2. At least a week later, once old PWA shells are replaced: migration `terms_enforcement_on`, in its
   own PR (kept out of `migrations/` until then, or `db push` would turn it on at step 1):

   ```sql
   -- Enforcement on (change: add-terms-acceptance, Rollout step 2).
   create or replace function public.terms_enforced()
   returns boolean
     language sql
     stable
     set search_path = ''
   as $$ select true $$;
   ```

   Tested in `supabase/tests/terms_acceptance.sql` (the suite switches it on inside its transaction),
   and every other suite passes with it on and all seed users accepted.
