## Context

Today, `friend-requests-sheet.vue` renders each request as a raw E.164 phone string and, on accept, auto-creates a contact passing the same phone as `firstName`. The requester's actual identity from `public.user_profile.first_name` / `last_name` is never read because no RPC exposes it (`user_profile` has RLS `select_own`).

Privacy model (updated): the email notification sent to the recipient already includes the sender's first/last name, so withholding the same name in the in-app inbox is theatre, not privacy. We loosen the disclosure boundary so that **the recipient of a pending friend request may resolve the sender's profile name**, in addition to confirmed friends. The reverse (sender resolving the recipient's profile name pre-accept) stays closed — the sender uses their own local contact name in the outgoing UI instead.

## Goals / Non-Goals

**Goals:**
- Show resolved sender name above lighter-colored phone in the recipient's inbox for both pending and accepted-but-uncontacted incoming requests.
- Show the sender's own local-contact name above lighter phone in outgoing rows (no server lookup).
- Auto-create a contact on accept using the requester's `user_profile` first/last name.
- Disclose name visibility on the sender side (`securityNote`) before sending.

**Non-Goals:**
- Backfilling existing contacts that were created with phone-as-firstName.
- Live-syncing future profile-name edits into the contact (one-shot read at accept time).
- Exposing the recipient's profile name to the sender via the server pre-accept (outgoing UI uses sender's local contacts only).
- Overwriting the sender's existing local contact name when their request is accepted — user-chosen name always wins on the sender side.
- Letting the recipient pick a custom contact name during the accept flow (can edit afterwards).

## Decisions

### RPC: `get_user_names_by_ids(p_user_ids uuid[])`

```sql
CREATE OR REPLACE FUNCTION public.get_user_names_by_ids(p_user_ids uuid[])
  RETURNS TABLE (user_id uuid, first_name text, last_name text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
declare
  v_caller_id uuid := auth.uid();
begin
  if not exists (
    select 1 from auth.users
    where id = v_caller_id and phone_confirmed_at is not null
  ) then
    return;
  end if;

  return query
  select up.id, up.first_name, up.last_name
  from public.user_profile up
  where up.id = any(p_user_ids)
    and (
      exists (
        select 1 from public.friendships f
        where (f.request_user_id = v_caller_id and f.response_user_id = up.id)
           or (f.request_user_id = up.id and f.response_user_id = v_caller_id)
      )
      or exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user_id = up.id
          and fr.to_user_id = v_caller_id
      )
    );
end;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_names_by_ids(uuid[]) TO authenticated;
```

**Rationale:**
- Same SECURITY DEFINER + `search_path = ''` pattern as the four existing friendship RPCs — consistent attack surface.
- Gating includes pending requests **only in the recipient direction** (`from_user_id = up.id AND to_user_id = v_caller_id`). This matches the real-world disclosure: email notification already reveals the sender's name to the recipient out-of-band, so the inbox row showing the same name is information-equivalent. The reverse direction stays closed — the sender does not need server-side name lookup because the outgoing UI uses the sender's own local contact data.
- Returns `text` (not enforced not-null) since `user_profile.first_name` is nullable; callers must fallback.
- Bulk (`uuid[]`) signature mirrors `find_phones_by_user_ids` for one-round-trip inbox population.

**Alternatives considered:**
- View with RLS: would require RLS policy referencing `friendships` which adds policy complexity and still needs SECURITY DEFINER to bypass `user_profile_select_own`. Function is simpler.
- Single-id signature: rejected — bulk is trivially more useful and only marginally more code.
- Resolving name on the server inside `accept_friend_request` and stuffing it in the returned row: tighter but couples two concerns and is harder to reuse for future "show friend's name" UX.

### Client integration

- `FriendshipRepository.getNamesByUserIds(ids: string[]) → Promise<Array<{userId, firstName: string | null, lastName: string | null}>>`.
- Store action `getNamesByUserIds` populates `userIdToNamesMap: Map<string, {firstName: string|null, lastName: string|null}>` (parallel to `userIdToPhoneMap`). Skip RPC when all ids cached or caller unverified.
- `friend-requests-sheet.vue` row rendering:
  - On mount + on inbox change, call `store.getNamesByUserIds([...incomingRequests.map(r => r.fromUserId)])` (incoming only — outgoing does not use the RPC).
  - `displayNameFor(req)` per direction:
    - Incoming: prefer `userIdToNamesMap.get(fromUserId)` joined `"first last"`; trim; fallback to `formatPhoneForDisplay(phone)`.
    - Outgoing: look up `contactsStore.contacts` for a contact whose `contactMethods` include the recipient's phone; use its `firstName + lastName`; fallback to `formatPhoneForDisplay(phone)`.
  - Phone always rendered on a second line in a lighter token (`color: var(--color-on-surface-variant)`, smaller font) so the user can cross-check.
- Accept handler (recipient): unchanged from prior design — resolve sender name via RPC (likely already cached), call `addContact(firstName, lastName, null, [{value: phone, isPrimary: true}])`; null-name fallback to `formatPhoneForDisplay(phone)`.
- Accept handler (sender): no contact mutation. Sender's local contact (if any) stays as the user set it.

### Disclaimer copy

- Sender (`friendships.prompt.securityNote`): append "Once accepted, your first and last name will be visible to them." — single key edit, both locales.
- Recipient (`friendships.acceptWarning`): **unchanged**. Existing deletion warning stays as-is. The recipient does not need to be told that accepting will reveal the requester's name — that disclosure is the sender's responsibility (sender opted in via the connect-prompt note).

Sender note rendered by existing `connect-prompt.vue`; no template changes, only i18n value updates.

### Testing strategy

- Unit: repository mocked `supabase.rpc` for `get_user_names_by_ids` — verify error path + empty-array short-circuit.
- Store: action populates map; idempotent on re-call; skipped when unverified.
- Component (`friend-requests-sheet.vue`):
  - Incoming row renders phone-only when RPC returns null first_name.
  - Outgoing row renders phone-only when no local contact matches the recipient phone.
  - Outgoing row renders the local contact's name (not the recipient's profile name) when one exists.
  - Accept flow: `addContact` called with profile name when RPC returns non-empty firstName; falls back to phone when null; skipped when contact already exists for phone.
- Per testing rules: skip pure happy-path tests; cover edge cases (null name, empty array, duplicate-contact short-circuit, missing local contact).

## Risks / Trade-offs

- **Name staleness**: contact firstName is a snapshot at accept time; if the friend later renames in their profile, the local contact does not update. → Acceptable: contact is user-editable; live-sync is out of scope.
- **Profile incomplete at accept time**: fallback to phone-as-name. → Acceptable; matches current UX. User can edit contact later when name becomes available.
- **Bulk RPC leak risk**: a caller could pass thousands of UUIDs and probe membership via name disclosure. → The disclosed set is exactly: friends ∪ {sender of any pending request to caller} — strictly a subset of `find_phones_by_user_ids`'s disclosure set, and email notifications already reveal sender identity to the same recipients. No new leak.
- **Outgoing-row stale name**: sender's local contact may be out of date relative to recipient's actual profile. → Acceptable; recipient's profile name is intentionally not disclosed to the sender pre-accept.
- **Migration ordering**: new migration depends on `public.user_profile` + `public.friendships` (both in baseline). No ordering risk.

## Migration Plan

1. Create migration with `supabase migration new get_user_names_by_ids` → produces `supabase/migrations/<timestamp>_get_user_names_by_ids.sql`. This is the SOLE place the new RPC + GRANT statements live; no other file (baseline included) is touched.
2. `supabase db reset` locally; verify RPC via SQL: as friend → returns row; as stranger → empty.
3. Implement client wiring + tests; verify accept flow end-to-end in dev.
4. After PR merge, deploy DB: `supabase db push` (user-prompted, manual step — applies every un-applied file from `supabase/migrations/` to prod in timestamp order).
5. Cloudflare Pages deploys frontend on release-please merge.

Rollback: revert the migration with a follow-up `drop function` migration; client code degrades gracefully (RPC error → fallback to phone-as-firstName already covers the no-data path with a small tweak).

## Open Questions

- None outstanding — all clarified pre-proposal with user.
