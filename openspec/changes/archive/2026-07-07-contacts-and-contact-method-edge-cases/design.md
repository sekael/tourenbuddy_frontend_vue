## Context

`contact_methods` already carries a denormalised, trigger-derived `user_id`
(`migrations/20260605082719`), a composite FK `(contact_id, user_id) → contacts(id, user_id)`,
and a per-contact unique constraint `(contact_id, method_type, value)`. Phone
values are stored normalised to E.164 on insert/update (`resolvePhoneValue`).

Friend requests and friendships are **user↔user** rows (`from_user_id/to_user_id`,
`request_user_id/response_user_id`). There is no link between a `contact_method`
row and a `friend_request` row — the connection is derived at runtime by resolving
a phone to a user (`find_user_by_phone` RPC → `relationshipsForPhone`). The
delete-method flow in `contact-detail-view.vue` already resolves this and shows
friend/pending warnings; the edit flow does not.

Neither `contacts` nor `contact_methods` has a `created_at` column (verified against
the baseline and all later migrations). `gen_random_uuid()` PKs are random (v4), so
there is **no timestamp or monotonic key** to define "the earliest" duplicate.

## Goals / Non-Goals

**Goals:**
- A phone/email value is unique to a single contact per user, enforced declaratively at the DB.
- Adding a value that already exists on another of the user's contacts is caught before insert and surfaced as an "edit the existing contact instead" disclaimer, on every entry point (manual add, add-method, import).
- Editing or deleting the contact method that resolves to a friend/pending user terminates that relationship (friendship removed, pending request cancelled/denied).
- Cancelling/blanking an add-method draft never blocks saving the contact.

**Non-Goals:**
- No `contact_method_id` FK on `friend_requests`/`friendships`; friend state stays user↔user (per decision — behavioural reuse, not schema association).
- No new email normalisation (emails compared as stored; see Risks).
- No cross-*user* uniqueness (two different users may each have the same number as a contact — unchanged).
- No merge UI that combines two contacts; the duplicate disclaimer only routes the user to edit the existing one or discard the draft.

## Decisions

### D1 — Enforce uniqueness with a declarative unique index, not a trigger
Add `create unique index contact_methods_value_unique_per_user on public.contact_methods (user_id, method_type, value)`.
- Covers both phone and email (per decision).
- `user_id` is already trigger-maintained and `NOT NULL`, and the composite FK prevents it drifting from the parent contact — so `(user_id, ...)` is a sound uniqueness key.
- Keep the existing `(contact_id, method_type, value)` constraint (migrations are immutable; it is subsumed but harmless).
- **Alternative rejected:** enforce in the repository/store only → violates the "constraints, not trigger/app-only" convention and races under realtime/concurrent writes.

### D2 — Deterministic dedupe before building the index (no timestamp available)
Because there is no `created_at`/monotonic key, "keep earliest" is undefined. Rule:
for each `(user_id, method_type, value)` group with >1 row, **keep** exactly one via
a deterministic `order by is_primary desc, id asc` (primary wins; ties, incl.
primary-on-both-contacts, break on lowest `id`); delete the rest.
Then **re-promote primary**: any contact left with phone methods but no primary
gets its lowest-`id` phone set `is_primary = true` (the app assumes a primary phone
exists; the partial one-primary index permits zero, so we must restore it).
- **Alternative rejected:** keep the row on the earliest-created *contact* → contacts also lack `created_at`, so equally undefined.
- **Alternative rejected (fail-loud):** abort the migration on any duplicate → the user chose auto-dedupe.

### D3 — New domain error for the cross-contact violation, distinct from per-contact
`23505` on `contact_methods_value_unique_per_user` → new `DuplicateContactAcrossContactsError`.
Keep mapping `contact_methods_unique_per_contact` → existing `DuplicateContactMethodError`.
The mapping applies to **both** `addMethod` (insert) and `updateMethod` (edit to a
value that duplicates another contact) — `updateMethod` currently rethrows the raw
error and must map `23505` on the per-user index the same way.
The store/UI does a **client-side pre-check** against the loaded `contacts` list
first (fast, no round-trip) so the disclaimer shows immediately **and can name the
conflicting contact** (enabling the "edit existing" action). The DB error is a rare
backstop for races / stale cache; it names only the index, not the row, so that
disclaimer **degrades to a generic "already exists" with a discard action only** (no
deep-link, no extra round-trip to resolve the contact).

### D4 — Edit break-point is a DB trigger mirroring delete (NOT frontend-only)
The three existing break-points (contact delete, phone-method delete, own-phone
delete) are all **BEFORE-mutation triggers** that call
`terminate_pending_and_friendship_between` in the same transaction
(`migrations/20260519185500`). Editing a phone value is the missing fourth
break-point. Add `cleanup_on_contact_method_update` as a
`BEFORE UPDATE ON contact_methods` trigger, guarded
`WHEN (old.method_type = 'phone' AND new.value IS DISTINCT FROM old.value)`, that
resolves the **OLD** value to a peer and calls the same helper. Keying on the old
value is essential — the relationship was created against the number being
replaced. The new value needs no action (adding a contact never auto-creates a
request).
- **Alternative rejected (frontend-only):** resolve + evict in the store before
  `updateMethod`. Rejected: leaves the invariant unenforced under direct API
  calls, inconsistent with the three sibling break-points and the friendships
  spec's "same transaction" guarantee. Reusing the existing trigger pattern is the
  established convention.
- The trigger is not a schema *association* — no FK from `friend_requests` to
  `contact_methods`; it re-resolves the phone in SQL exactly like the delete
  trigger already does.
- **method_type is immutable (F5).** A `phone → email` type flip keeping the same
  `value` would break the friend link without changing `value`, dodging the
  value-change guard. Rather than broaden the guard, forbid it at the source: the
  `BEFORE UPDATE` trigger raises if `new.method_type IS DISTINCT FROM old.method_type`.
  The app never changes a method's type on edit, so this blocks only a raw-API path
  with no legitimate use and keeps the break-point guard simple.

### D5 — Edit UI: check order, client removeFriendship for notification parity
The edit-save runs its client checks in this order:
1. **Duplicate pre-check first** (D3) on the NEW value. If it collides with another
   of the user's contacts, show the duplicate disclaimer and stop — the user never
   sees a friend-eviction warning for an edit that cannot commit anyway.
2. Only if the edit can succeed: resolve the **OLD** value via
   `relationshipsForPhone`; if it links a friend/pending user, show the inline
   warn/confirm (same pattern as delete).

On confirm, the client persists the update **first**, then calls
`removeFriendship(oldPeerUserId)` for notification fanout. Order matters:
`removeFriendship` fires its tour-link group-membership notifications only *after*
its RPC succeeds, so calling it before a failing update would emit a false "group
dissolved" notification. With update-first, the `BEFORE UPDATE` trigger terminates
friendship + pending atomically in the update's transaction; the subsequent
`removeFriendship` call then (a) snapshots tour-link recipients from still-intact
local state and fires the notifications, and (b) issues an idempotent delete that
affects zero rows (already gone). Pending-request termination is left entirely to
the D4 trigger (the delete-method path does not client-notify pending either).

The edit never auto-creates any relationship toward the NEW value — friend requests
stay explicit user actions, identical to adding a contact through any other path.

The delete path is unchanged: already fully DB-enforced, and its existing client
`removeFriendship` call provides the same notification fanout.

### D6 — Stale-save fix: clear on cancel + gate on form visibility
`cancelAddMethod` clears `addMethodError`; `saveAll`'s failure gate becomes
`hasMethodError || (showAddMethod && addMethodError)`. A blank add-method draft is
already discarded silently by `saveAll` (it only calls `confirmAddMethod` when
`newMethodValue` is non-empty) — unchanged. Root cause is a stale ref read across a
hidden form, so both clearing and gating are applied (defence in depth).

### D7 — Manual add-contact becomes atomic via an RPC (F1)
`addContact` currently creates the `contacts` row then loops `addMethod` inserts —
non-atomic. If a method insert fails (e.g. a duplicate that slipped past the
pre-check on the race/stale-cache path), a bare orphan contact is left, violating
the spec's "no partial creation". Add a `create_contact_with_methods(contact, methods[])`
`SECURITY DEFINER` RPC that inserts the contact and all its methods in one
transaction; a unique-violation aborts the whole insert, so nothing is persisted.
The repo maps the RPC's `23505` to the duplicate error as elsewhere.
- **Alternative rejected (client rollback):** delete the just-created contact in the
  `catch`. Smaller, but leaves a real window (the delete itself can fail / the tab
  can close) and re-implements transactionality in the client — the DB does it
  correctly for free.
- Import (`use-contact-import` → `addContact`) shares this path, so it inherits
  atomicity per imported contact.

### D8 — Scope: phones only for import + new-contact form (F6/F7)
Import persists **phones only** today (`addContact(..., phones)`; parsed emails are
discarded), and the new-contact form has no email field. This change does **not**
add email to either — the duplicate disclaimer applies to phones on those surfaces,
and to phone *and* email only on add-method-of-an-existing-contact (the one surface
that supports email). The per-user unique index still covers both types (it is the
backstop for the add-method email case). Email on import / new-contact is future work.

## Risks / Trade-offs

- **Email case/whitespace duplicates** → emails are compared byte-for-byte, so `A@x.com` and `a@x.com` are treated as distinct. Accepted for now; add email normalisation later if it matters. `// ponytail: no email normalisation, add if dupes by case appear`.
- **Dedupe deletes user data** → a losing contact silently loses one method. Mitigation: prefer the `is_primary` row so the user's chosen number survives; document in the migration; local-first verification before prod push. Irreversible once pushed — verify on a prod snapshot first.
- **Client pre-check vs DB backstop divergence** → local `contacts` cache may be stale (realtime lag), so the DB error must still map to the friendly disclaimer, not a raw 23505. Both paths funnel to the same UI message.
- **Edit-evict direction bug** → resolving the new value instead of the old would evict the wrong (or no) relationship. Covered by a store unit test on the edit path.
- **Concurrent add of the same number to two contacts** → the unique index makes the second insert fail; UI maps it to the disclaimer. No lost writes.

## Migration Plan

1. `supabase migration new contact_method_value_unique_per_user` — dedupe (D2) then `create unique index`. No `grant` needed (index only; table grants already exist).
2. `supabase migration new cleanup_on_contact_method_update` — `cleanup_on_contact_method_update()` (mirrors `cleanup_on_contact_method_delete`, uses OLD value) + `BEFORE UPDATE` trigger. Same trigger (or a sibling in the same file) **raises on any `method_type` change** (D4/F5). Trigger fires on phone value-change; grants mirror the sibling functions.
3. `supabase migration new create_contact_with_methods` — atomic `SECURITY DEFINER` RPC (D7); `revoke all … from public` + `grant execute … to authenticated`.
4. `supabase db reset`, run `npm run test`, verify all flows locally against local stack.
5. Rollback: `drop index …` / `drop trigger …` / `drop function …` (fix-forward migrations); deleted duplicate rows are **not** restorable — hence prod-snapshot verification first.
6. `supabase db push` only after review (prompt user; never unprompted). No Worker deploy involved.

## Open Questions

- None blocking. Email normalisation deferred (Risks). No Worker (`services/email-hook`) change is involved.
