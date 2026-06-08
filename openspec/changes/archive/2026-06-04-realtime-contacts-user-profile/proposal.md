## Why

Contact create / update / delete and profile changes (name, phone, locale, notification settings) currently propagate to a user's other devices only on next manual fetch (app reload / navigation). Tours and friendships already sync live via Supabase Realtime (#189); contacts and the user profile — also frequently edited surfaces — do not. Issue #193 asks to close that gap with the same `postgres_changes` pattern. This change also closes the cross-device contact-delete reconciliation gap that #189 explicitly deferred here.

## What Changes

- Subscribe `contacts-store` to `postgres_changes` for `public.contacts` and `public.contact_methods`, both filtered `user_id=eq.${currentUserId}`. On any change, debounced full `loadContacts()` refetch.
- Subscribe `user-profile-store` to `postgres_changes` for `public.user_profile`, filtered by `id=eq.${currentUserId}` — **not** `user_id`: `user_profile`'s primary key IS the auth user id (`user_profile.id → auth.users.id`); there is no `user_id` column.
- **Cross-device contact-delete reconciliation (the #189 deferral):** when a contact is deleted, the DB cascade removes its `tour_partners` rows, but `tour_partners` was excluded from the tours publication, so remote devices never learn their tours lost a partner. The local-only `tours-store.$onAction(deleteContact)` reconciler does NOT fire on remote devices (realtime calls `loadContacts()`, not the action). This change adds `tour_partners` to the publication so `tours-store` reconciles partner ids on **every** device via realtime. The local `$onAction` reconciler is kept for optimistic snappiness on the editing device.
- **Denormalisation for user-scoped filtering (`contact_methods` and `tour_partners`):** neither table has a `user_id`, and both are written independently of (or cascade-bypass) their realtime-subscribed parent. Each gets a derived `user_id` column, populated server-side by a `BEFORE INSERT OR UPDATE` trigger from its parent (`contact_methods` ← parent contact's owner; `tour_partners` ← parent tour's owner). Because `user_id` is derived, never client-supplied, it can never conflict with the parent's owner.
- **Declarative integrity (composite FKs).** Rather than depend implicitly on the trigger, the parent-ownership invariant is enforced by a composite foreign key:
  - `contact_methods`: **DROP** the single-column `contact_id` FK, **ADD** `(contact_id, user_id) → contacts(id, user_id) ON DELETE CASCADE` — one relationship serving integrity, the contact-delete cascade, and the PostgREST `contact_methods(*)` embed (keeping both FKs would make the embed ambiguous).
  - `tour_partners`: **DROP** the single-column `tour_id` FK, **ADD** `(tour_id, user_id) → tours(id, user_id) ON DELETE CASCADE`; **KEEP** the `contact_id → contacts` FK (different parent — it is the contact-delete cascade that drives the reconciliation above).
  - Both require a `UNIQUE(id, user_id)` on the parent (`contacts`, `tours`) as the FK target.
- Add `public.contacts`, `public.contact_methods`, `public.tour_partners`, and `public.user_profile` to the `supabase_realtime` publication and set `REPLICA IDENTITY FULL` on each.
- Reuse the existing `useRealtimeSubscription` primitive — no new infra. New realtime stores mirror the established tours-store / `use-realtime-subscription` conventions (channel-key computed, per-store sign-out watcher → `clear()`, `onSubscribed` baseline refetch).

## Capabilities

### New Capabilities

_None._ Reuses the existing realtime primitive.

### Modified Capabilities

- `contacts`: contacts list (including phone/email methods) MUST stay in sync across the same user's devices. Covers channel key, bindings, debounced refetch, sign-out teardown, and the `contact_methods.user_id` derived-column + composite-FK invariant.
- `user-profile`: profile state MUST react to remote changes across the same user's devices. Covers the `id`-scoped binding and debounced refetch.
- `tours`: a tour's partner set MUST reconcile across devices when a partnered contact is deleted, via a `tour_partners` realtime binding on the existing tours channel. Covers the `tour_partners.user_id` derived-column + composite-FK invariant and the second binding on `tours-${uid}`.

## Impact

- **Schema (new migration only — history immutable):**
  - `contact_methods`: add derived `user_id` (`BEFORE INSERT OR UPDATE` trigger ← parent contact); backfill; `SET NOT NULL`. Drop single `contact_id` FK; add composite `(contact_id, user_id) → contacts(id, user_id) ON DELETE CASCADE`.
  - `tour_partners`: add derived `user_id` (`BEFORE INSERT OR UPDATE` trigger ← parent tour); backfill; `SET NOT NULL`. Drop single `tour_id` FK; add composite `(tour_id, user_id) → tours(id, user_id) ON DELETE CASCADE`; keep `contact_id` FK.
  - `contacts`, `tours`: add `UNIQUE(id, user_id)` (composite-FK targets).
  - `REPLICA IDENTITY FULL` on `contacts`, `contact_methods`, `tour_partners`, `user_profile`.
  - Add all four tables to `supabase_realtime` (guarded with `duplicate_object`).
  - No `CREATE TABLE` → no new Data API grants required.
  - Migration order: add column → trigger → backfill → `SET NOT NULL` → parent `UNIQUE` → drop old single FK → add composite FK → `REPLICA IDENTITY FULL` → publication.
- **Frontend:**
  - `contacts-store`: wire `useRealtimeSubscription` (key `contacts-${uid}`, bindings on `contacts` + `contact_methods` filtered `user_id=eq.${uid}`, `onChange`/`onSubscribed` → `loadContacts`). Add sign-out watcher → `clear()`.
  - `user-profile-store`: wire subscription (key `user-profile-${uid}`, single binding on `user_profile` filtered `id=eq.${uid}`, `onChange`/`onSubscribed` → `loadProfile`). Add sign-out watcher → `clear()`.
  - `tours-store`: add `tour_partners` as a **second binding** on the existing `tours-${uid}` channel (filter `user_id=eq.${uid}`), `onChange` → the same debounced `loadTours()`. Keep the local `$onAction(deleteContact)` reconciler.
- **No notification dispatch from `onChange`** — Realtime is UI-sync only.
- **RLS:** unchanged. Existing `*_select_own` policies remain the sole authorization gate; the derived `user_id` columns are for the Realtime *filter* only. PostgREST schema cache reloads on `db push`/reset (Supabase auto-reload) to pick up the composite FK relationship.
- **Tests:** channel-key derivation (null when unauthenticated); binding shape (`user_id` for contacts/methods/partners, `id` for user_profile); reload-on-change; sign-out teardown; `tour_partners` second binding triggers `loadTours`.
- **Backwards compat:** additive (FK swap preserves cascade + embed). Migration forward-only and idempotent. The derived columns + composite FKs make the invariant hold by construction, independent of write path.
