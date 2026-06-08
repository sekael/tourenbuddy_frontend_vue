## Context

Contacts and the user profile are written through `contacts-store` (+ `contact-methods` repo) and the user-profile store. Today only the writing device sees the result; other devices stay stale until a manual fetch. Tours and friendships already solved this with the generic Realtime primitive (`src/core/realtime/use-realtime-subscription.ts`). This change reuses that primitive verbatim and adds four tables to the `supabase_realtime` publication.

Three table-shape facts drive the design:

1. **`user_profile` has no `user_id`.** Its primary key `id` *is* the auth user id (`user_profile_id_fk → auth.users.id`). The Realtime filter is therefore `id=eq.${uid}`, not `user_id=eq.${uid}`.
2. **`contact_methods` has no `user_id` and is written independently of `contacts`.** The repo writes phones/emails directly (`addMethod` / `updateMethod` / `removeMethod` / `setPrimaryPhone`) without touching the parent `contacts` row. So a `contacts`-only subscription misses phone-only edits, and `contact_methods` has no `user_id` for the filter to match.
3. **`tour_partners` has no `user_id`, and contact-delete cascades bypass `tours`.** #189 excluded `tour_partners` from the tours publication because every *in-app* partner change is preceded by a parent `tours` write — **except** the `contacts → tour_partners ON DELETE CASCADE` path, which #189 explicitly deferred to this change. The intended handler — `tours-store.$onAction(deleteContact)` — only fires on the *local* device; realtime calls `loadContacts()` (a refetch), never the action, so remote devices never reconcile. That broken assumption reopens the decision (Decision 1).

## Goals / Non-Goals

**Goals:**
- Contact create / update / delete (including phone/email methods) and profile changes propagate to all of the same user's signed-in devices within one debounce window (~150 ms).
- A tour's partner set reconciles across devices when a partnered contact is deleted.
- Zero new client infrastructure: reuse `useRealtimeSubscription`; mirror established conventions.
- The parent-ownership invariant on the derived `user_id` columns holds **by construction** (declarative FK + server-side derivation), not by trusting a code path.
- Migration is forward-only, idempotent, respects "migrations immutable".
- No notification dispatch from Realtime handlers.

**Non-Goals:**
- Cross-user collaboration on shared contacts.
- Per-event payload patching (full debounced refetch, as with tours/friendships).
- Offline-first / merge-on-reconnect semantics.
- Reassigning a contact to a different user (`contacts.user_id` is treated as immutable — Decision 5).

## Decisions

### Decision 1: Reconcile contact-delete via `tour_partners` in the publication (revisit #189)
- **Choice:** add `tour_partners` to the `supabase_realtime` publication (with a derived `user_id` filter) and bind it in `tours-store`. On a `tour_partners` change, `tours-store` runs a debounced `loadTours()`, reconciling partner ids on every device.
- **Why over a contacts→tours cross-store call:** #189's exclusion rested on "contact-cascade handled in #193", and the assumed handler doesn't fire remotely. The publication approach **decouples** (tours reacts to its own domain, contacts-store never references tours — matching "deps point inward"), is **symmetric** with the `contact_methods` denormalisation already in this change, is **defensive** (catches any `tour_partners` mutation, not just cascade), and is **precise** (reacts to the actual DELETE, not a coarse "contacts changed → reload all tours").
- **Cost:** extra DDL (one more derived column + FK), accepted because the cascade reconciliation is already this change's obligation and the machinery is shared with `contact_methods`.
- **Rejected:** contacts `onChange` → `toursStore.loadTours()` (inverts the existing clean dependency direction, coarse); leaving partner ids stale (visible inconsistency).
- **Keep** the local `tours-store.$onAction(deleteContact)` reconciler for optimistic snappiness on the editing device; realtime makes every other device correct.

### Decision 2: Denormalise `user_id` (derived) onto `contact_methods` and `tour_partners`
- **Choice:** add `user_id uuid`; a `BEFORE INSERT OR UPDATE` trigger sets `NEW.user_id` from the parent (`contact_methods` ← `contacts.user_id` via `contact_id`; `tour_partners` ← `tours.user_id` via `tour_id`). Backfill, then `SET NOT NULL`.
- **Why the value is never trusted from the client:** derivation makes a conflicting `user_id` impossible under INSERT, UPDATE, or a parent-id reparent. The invariant holds by construction.
- **Per statement type:** INSERT/UPDATE — trigger derives; DELETE — nothing to derive, `REPLICA IDENTITY FULL` carries the stored `user_id` so the `user_id=eq` filter matches DELETE events.
- **Rejected — unfiltered subscription relying on RLS transitivity:** `*_select_own` policies already express the transitive join, so an unfiltered sub would deliver only authorized rows *correctly*. Rejected on **cost**, not correctness — without a server-side WAL filter, Realtime evaluates the policy per-row, per-subscriber, for every user's change. The derived filter is a cheap WAL prefilter and honours the "filters MUST be user-scoped" convention.

### Decision 3: Enforce the invariant declaratively with a composite FK
- **Choice:** the parent-ownership pair is enforced by a composite FK, so the DB is self-guaranteeing regardless of which path writes — not implicitly dependent on the trigger.
  - `contact_methods`: **DROP** `contact_methods_contact_id_fkey`; **ADD** `(contact_id, user_id) → contacts(id, user_id) ON DELETE CASCADE`.
  - `tour_partners`: **DROP** `tour_partners_tour_id_fkey`; **ADD** `(tour_id, user_id) → tours(id, user_id) ON DELETE CASCADE`; **KEEP** `tour_partners_contact_id_fkey` (different parent — the contact-delete cascade behind Decision 1).
  - Add `UNIQUE(id, user_id)` on `contacts` and `tours` (a composite FK's target must be a unique constraint on the *exact* referenced columns; the PK on `id` alone does not satisfy it).
- **Trigger + FK have distinct roles:** the trigger *supplies* `user_id` (so writes succeed without the client providing it); the FK *validates* the pair (so drift is structurally impossible). Both kept.
- **Why collapse to one FK on `contact_methods` (not keep both):** `contact_methods` is embedded via PostgREST (`.select('*, contact_methods(*)')`). Two FKs between the same table pair make the embed **ambiguous** ("more than one relationship found"). One composite FK keeps the embed unambiguous (PostgREST supports composite FKs for embedding), preserves the cascade, and enforces integrity — one relationship, three roles. `tour_partners` is not embedded, but its two FKs target *different* parents, so no ambiguity; the redundant single `tour_id` FK is replaced by the composite, the `contact_id` FK stays.
- **ON UPDATE:** parents' `id`/`user_id` are immutable, so composite FKs use the default `NO ACTION` on update.

### Decision 4: Full debounced refetch; distinct per-store channels; `tour_partners` shares the tours channel
- Full debounced refetch over payload patching (loaders already canonicalise shaped output; bursts collapse via the 150 ms debounce).
- Distinct channels `contacts-${uid}` and `user-profile-${uid}` (the primitive's per-key dedupe is refcount-only — shared-key multi-binding across stores is unsafe).
- `tour_partners` is wired as a **second binding on the existing `tours-${uid}` channel** (the primitive iterates `bindings()` on one channel). A partner change that also touches `tours` (via `update_tour_full`) coalesces both events into one debounced `loadTours()`. No second WS subscription.

### Decision 5: `contacts.user_id` treated as immutable
- `contacts.user_id` defaults to `auth.uid()` and is never reassigned. The `contact_methods` trigger derives at method-write time; a (non-existent) contact-reparent would not retro-update method rows. Documented as an assumption rather than guarded with a reverse-cascade trigger.

### Decision 6: `REPLICA IDENTITY FULL` on all four tables
- DELETE (and UPDATE) events need full row contents so the `user_id=eq` / `id=eq` filters apply; without `FULL`, only PK columns ship and filtered DELETE events would be dropped.

### Decision 7: Reuse established conventions
- New realtime stores mirror the proven tours-store / `use-realtime-subscription` patterns: `channelKey` computed, `realtimeEnabled` computed, per-store `watch(isAuthenticated)` → `clear()`, `onSubscribed` baseline refetch. No new teardown registry. Profile edit forms already use local draft refs (`editFirstName`, onboarding `firstName`), so an echo refetch cannot clobber in-progress edits — no gating needed.

## Risks / Trade-offs

- **[Risk]** Dropping/recreating FKs in a migration.
  → **Mitigation:** forward-only; composite FK added after backfill so all existing rows validate; FK swap preserves cascade semantics and (for `contact_methods`) the embed.
- **[Risk]** PostgREST schema cache stale after the FK change.
  → **Mitigation:** Supabase auto-reloads the cache on `db push` / `db reset`; verify the embed still resolves post-migration.
- **[Risk]** Burst of method writes (vCard import) → multiple refetches.
  → **Mitigation:** 150 ms debounce coalesces.
- **[Risk]** Backfill locks rows on large tables.
  → **Mitigation:** personal address-book volumes are small.
- **[Trade-off]** Derived columns are schema-for-infra. Accepted: they restore convention-compliant filtering, and the trigger + composite FK make drift impossible.

## Migration Plan

1. `supabase migration new realtime_contacts_profile_publication`.
2. One forward-only file, in order, for each of `contact_methods` (parent `contacts`) and `tour_partners` (parent `tours`):
   - `add column user_id uuid;`
   - trigger function (`security definer`, `set search_path = ''`) + `BEFORE INSERT OR UPDATE` trigger deriving `user_id` from the parent;
   - backfill `update … set user_id = parent.user_id from parent …;`
   - `alter column user_id set not null;`
   - `alter table <parent> add constraint <parent>_id_user_id_key unique (id, user_id);`
   - drop the single-column parent FK; add the composite FK `(… , user_id) → <parent>(id, user_id) on delete cascade`;
   - then `replica identity full` and publication add for `contacts`, `contact_methods`, `tour_partners`, `user_profile`.
3. `supabase db reset` locally; verify in `psql`: publication membership; `relreplident='f'` on all four; `select count(*) from contact_methods cm join contacts c on c.id=cm.contact_id where cm.user_id<>c.user_id` = 0 (and the `tour_partners`/`tours` analogue = 0); the `contacts` embed still resolves.
4. Manual smoke test across two sessions (same user) + a contact-delete partner-reconciliation check.
5. `supabase db push` to prod only after PR approval.
6. **Rollback:** new forward-only migration dropping publication entries, composite FKs, triggers, columns, and restoring the single-column FKs; reset `replica identity` to DEFAULT. Never edit history.

## Open Questions

_None remaining. Resolved during the grilling pass:_
- Cascade reconciliation → `tour_partners` in publication (Decision 1); keep local `$onAction`.
- Denormalisation → derived `user_id` + composite FK on both link tables (Decisions 2–3).
- `contact_methods` FK → collapse to one composite (embed disambiguation); `tour_partners` → composite tours FK + keep contacts FK.
- `user_profile` filter → `id=eq.${uid}`.
- Teardown → per-store auth watcher → `clear()`.
- `tour_partners` binding → second binding on the existing tours channel.
