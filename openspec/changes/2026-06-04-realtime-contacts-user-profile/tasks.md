## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/193-realtime-contacts-profile`
- [x] 1.2 Verify `supabase status` shows the local stack running (`supabase start` if not).

## 2. Migration: derived user_id + composite FKs + publication

- [x] 2.1 `supabase migration new realtime_contacts_profile_publication`.
- [x] 2.2 **YOUR TURN** — write the derived-`user_id` columns + keep-in-sync triggers for `contact_methods` (← parent `contacts`) and `tour_partners` (← parent `tours`). See gap task below.
- [x] 2.3 Backfill: `update public.contact_methods cm set user_id = c.user_id from public.contacts c where c.id = cm.contact_id;` and the `tour_partners`/`tours` analogue.
- [x] 2.4 `alter table public.contact_methods alter column user_id set not null;` and same for `tour_partners`.
- [x] 2.5 Parent unique targets: `alter table public.contacts add constraint contacts_id_user_id_key unique (id, user_id);` and `alter table public.tours add constraint tours_id_user_id_key unique (id, user_id);`.
- [x] 2.6 `contact_methods`: drop `contact_methods_contact_id_fkey`; add `(contact_id, user_id) references public.contacts(id, user_id) on delete cascade`.
- [x] 2.7 `tour_partners`: drop `tour_partners_tour_id_fkey`; add `(tour_id, user_id) references public.tours(id, user_id) on delete cascade`. **Keep** `tour_partners_contact_id_fkey`.
- [x] 2.8 `replica identity full` on `contacts`, `contact_methods`, `tour_partners`, `user_profile`.
- [x] 2.9 Add all four tables to `supabase_realtime`, each wrapped in `do $$ … exception when duplicate_object then null; end $$;` (mirror `20260520101408_realtime_friendships_publication.sql`).
- [x] 2.10 `supabase db reset` locally; confirm clean apply.
- [x] 2.11 Verify in `psql`: publication contains all four tables; `relreplident='f'` on each; both consistency checks (`cm.user_id<>c.user_id` and `tp.user_id<>t.user_id`) return `0`; the `contacts` → `contact_methods` PostgREST embed still resolves (no "more than one relationship" error).

## 3. Contacts store wiring

- [x] 3.1 Add `channelKey` (`contacts-${uid}` else `null`) and `realtimeEnabled` computeds.
- [x] 3.2 Wire `useRealtimeSubscription`: two bindings — `contacts` and `contact_methods`, both `{ event: '*', filter: 'user_id=eq.${uid}' }`.
- [x] 3.3 `onChange: loadContacts`, `onSubscribed: () => loadContacts()`.
- [x] 3.4 Add `watch(() => authStore.isAuthenticated, v => { if (!v) clear() })` (mirror tours-store).

## 4. User-profile store wiring

- [x] 4.1 Add `channelKey` (`user-profile-${uid}`) and `realtimeEnabled` computeds.
- [x] 4.2 Wire `useRealtimeSubscription`: single binding `{ event: '*', table: 'user_profile', filter: 'id=eq.${uid}' }` — **`id`, not `user_id`**.
- [x] 4.3 `onChange` / `onSubscribed` → `loadProfile()`.
- [x] 4.4 Add `watch(() => authStore.isAuthenticated, v => { if (!v) clear() })`.

## 5. Tours store: tour_partners reconciliation

- [x] 5.1 In `tours-store`, add `tour_partners` as a **second binding** on the existing `tours-${uid}` channel: `{ event: '*', table: 'tour_partners', filter: 'user_id=eq.${uid}' }`.
- [x] 5.2 Confirm its `onChange` runs the same debounced `loadTours()` (one channel, two bindings).
- [x] 5.3 Leave the local `$onAction(deleteContact)` reconciler in place (optimistic snappiness on the editing device).

## 6. Tests

- [x] 6.1 `contacts-store`: channel key `null` / `enabled=false` when unauthenticated.
- [x] 6.2 `contacts-store`: two bindings (`contacts`, `contact_methods`), both filtered `user_id=eq.<uid>`.
- [x] 6.3 `contacts-store`: `onChange` triggers `loadContacts` after the debounce.
- [x] 6.4 `user-profile-store`: single binding on `user_profile` filtered by **`id`** (regression guard against `user_id`).
- [x] 6.5 `tours-store`: `tours-${uid}` channel now has both `tours` and `tour_partners` bindings; a `tour_partners` event triggers `loadTours`.
- [x] 6.6 Both stores: sign-out watcher calls `clear()`.
- [x] 6.7 `npm run test` — all pass.

## 7. Manual verification

- [x] 7.1 Two sessions signed in as the same user (local Supabase + dev server).
      > NOTE: After `db reset`, run `supabase stop && supabase start` so Realtime's
      > replication slot picks up the newly-published tables. `db reset` alone leaves
      > the slot decoding the old table set — channel reports SUBSCRIBED but the new
      > tables emit zero events. Cloud handles this on `db push`; still confirm in 8.6.
- [x] 7.2 Create a contact on A → appears on B within one debounce window.
- [x] 7.3 Edit a contact's name on A → reflects on B.
- [x] 7.4 **Add/edit/remove a phone** (method-only change) on A → reflects on B (the path the `contact_methods` denormalisation enables).
- [x] 7.5 **Delete a contact partnered on a tour** on A → on B the contact disappears AND the tour drops the partner id (via the `tour_partners` realtime binding, not just the local reconciler). Verify on a fresh B that never ran `deleteContact`.
- [x] 7.6 Change profile (name / locale / notification setting) on A → reflects on B.
- [x] 7.7 Sign out on A → no further Realtime events (DevTools → WS frames); local data cleared.

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` — zero warnings.
- [x] 8.2 `npm run type-check` — passes.
- [x] 8.3 `npm run test` — all pass.
- [x] 8.4 Prompt user to commit. Suggested message:
      ```
      feat(contacts): realtime sync for contacts, profile, and tour partners

      Subscribe contacts-store (contacts + contact_methods), user-profile-store
      (user_profile, id-scoped), and a tour_partners binding on the tours
      channel to postgres_changes via the shared useRealtimeSubscription
      primitive. Cross-device contact/profile edits and contact-delete partner
      reconciliation now propagate within one debounce window without reload.
      Denormalises a server-derived user_id onto contact_methods and
      tour_partners (BEFORE INSERT/UPDATE trigger from the parent) and enforces
      the parent-ownership pair with a composite FK; for contact_methods this
      collapses to a single composite FK to keep the PostgREST embed
      unambiguous. Sets REPLICA IDENTITY FULL and registers all four tables in
      the supabase_realtime publication. RLS unchanged.

      Closes #193
      ```
- [x] 8.5 Prompt user to `git push -u origin feat/193-realtime-contacts-profile` and open a PR against `main`.
- [x] 8.6 Prompt user to `supabase db push` against prod *only after* PR approval (confirm PostgREST embed resolves post-deploy).
- [x] 8.7 After merge, prompt user to archive this change with `/opsx:archive`.

---

## Your turn

**File:** `supabase/migrations/<new timestamp>_realtime_contacts_profile_publication.sql`
**Lines:** the derived-`user_id` column + trigger blocks for `contact_methods` and `tour_partners` (task 2.2)
**Gap:** add a `user_id` column to each link table and the trigger that keeps it equal to the parent's owner

**What it needs to do:**
- For `contact_methods`: `add column user_id uuid;` + a trigger function that sets `NEW.user_id := (select user_id from public.contacts where id = NEW.contact_id)`, attached `BEFORE INSERT OR UPDATE`.
- For `tour_partners`: the same shape, deriving from `public.tours` via `NEW.tour_id`.
- **Derive server-side — never trust a client-supplied `user_id`.** INSERT and `*_id`-reparenting UPDATEs both keep it correct; DELETE needs no derivation (`REPLICA IDENTITY FULL` carries the stored value).
- Functions `security definer`, `set search_path = ''`, fully-qualified names — mirror existing trigger functions in `supabase/migrations/`.
- (Backfill, `NOT NULL`, parent `UNIQUE`, and the composite-FK swap are tasks 2.3–2.7 — the trigger is the conceptual core here.)

**How to verify:**
- Automated: `supabase db reset`, then in `psql`:
  `select count(*) from contact_methods cm join contacts c on c.id=cm.contact_id where cm.user_id<>c.user_id;` → `0`, and the `tour_partners`/`tours` analogue → `0`.
- Insert a row with a deliberately wrong `user_id` and confirm the trigger overwrites it to the parent's owner; confirm the composite FK then *rejects* any attempt to set a mismatched pair if the trigger were bypassed.

**Done when:** every `contact_methods` and `tour_partners` row's `user_id` equals its parent's `user_id` after reset, and a wrong client-supplied value on INSERT/UPDATE is corrected by the trigger (and structurally rejected by the composite FK).
