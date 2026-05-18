## 1. Git Setup

- [x] 1.1 Run `git fetch origin && git checkout main && git pull && git checkout -b feat/162-friend-accept-uses-profile-names`

## 2. Database Migration

- [x] 2.1 `supabase migration new get_user_names_by_ids` — generates `supabase/migrations/<timestamp>_get_user_names_by_ids.sql`. ALL new DB objects live here, nowhere else.
- [x] 2.2 Author the SQL: `CREATE OR REPLACE FUNCTION public.get_user_names_by_ids(p_user_ids uuid[]) RETURNS TABLE (user_id uuid, first_name text, last_name text)` — SECURITY DEFINER, `SET search_path TO ''`, phone-verified caller guard, gating: friendship in either direction OR pending `friend_requests` where caller is `to_user_id` (recipient direction only)
- [x] 2.3 Append `GRANT EXECUTE ON FUNCTION public.get_user_names_by_ids(uuid[]) TO authenticated;` (and `anon`, `service_role` mirroring sibling RPCs in baseline)
- [x] 2.4 `supabase db reset` and verify locally: as friend → row returned; as stranger → empty; as recipient of pending request → row returned; as sender of pending request (no friendship) → empty; as unverified caller → empty
- [x] 2.5 Confirm no edits to existing migrations (immutable rule)
- [x] 2.6 Note in PR body: prod rollout requires `supabase db push` (manual deploy step) so the new migration file is applied

## 3. Repository Layer

- [x] 3.1 Add `getNamesByUserIds(userIds: string[]): Promise<Array<{ userId: string, firstName: string | null, lastName: string | null }>>` to `src/features/friendships/domain/repositories/friendship-repository.ts`
- [x] 3.2 Implement in `src/features/friendships/data/repositories/friendship-repository-impl.ts`: empty-input short-circuit; `supabase.rpc('get_user_names_by_ids', { p_user_ids })`; map snake → camel; throw on error

## 4. Store Layer

- [x] 4.1 Add `userIdToNamesMap = ref(new Map<string, { firstName: string | null, lastName: string | null }>())` to `friendships-store.ts`
- [x] 4.2 Add `getNamesByUserIds(ids)` action: skip when not phone-verified or all ids already cached; otherwise call repo, merge into map, return the lookup for the requested ids
- [x] 4.3 Clear `userIdToNamesMap` in the existing `clear()` action
- [x] 4.4 Expose `userIdToNamesMap` and `getNamesByUserIds` from store return

## 5. Inbox UI + Accept Flow + Disclaimers

- [x] 5.1 `friend-requests-sheet.vue`: on mount + watcher on `incomingRequests`, call `store.getNamesByUserIds([...incomingRequests.map(r => r.fromUserId)])` (next to existing `findPhonesByUserIds` call)
- [x] 5.2 Add `displayNameFor(req, direction)` helper:
      - direction `incoming`: read `userIdToNamesMap.get(req.fromUserId)`; join `firstName + " " + lastName` and trim; if empty → return null
      - direction `outgoing`: find `contacts.value` entry whose `contactMethods` include the recipient's phone (use `userIdToPhoneMap.get(req.toUserId)`); join its `firstName + " " + lastName`; if no match → null
- [x] 5.3 Update the request-row template: when `displayNameFor` returns a name → render name (primary) + formatted phone in a lighter secondary line; when null → render formatted phone alone on primary line. Apply to both `incomingRequests` and `outgoingRequests` loops.
- [x] 5.4 Add scoped styles `.request-phone-sub { font-size: var(--font-size-xs, 11px); color: var(--color-on-surface-variant); }`
- [x] 5.5 Accept handler `maybeCreateContactForFriend`: after `store.accept` succeeds, call `store.getNamesByUserIds([fromUserId])`, resolve `{firstName, lastName}`. If `firstName?.trim()` non-empty → `addContact(firstName.trim(), lastName?.trim() || null, null, [{ value: phone, isPrimary: true }])`; else `addContact(formattedPhone, null, null, ...)`.
- [x] 5.6 Update `src/locales/en.json` `friendships.prompt.securityNote` — append sentence: "Once accepted, your first and last name will be visible to them."
- [x] 5.7 Update `src/locales/de-CH.json` `friendships.prompt.securityNote` — German equivalent
- [x] 5.8 Leave `friendships.acceptWarning` unchanged in both locales

## 6. Tests

- [x] 6.1 `test/features/friendships/data/repositories/friendship-repository-impl.test.ts` — `getNamesByUserIds`: empty input returns `[]` without rpc call; rpc error throws; snake→camel mapping
- [x] 6.2 `test/features/friendships/presentation/stores/friendships-store.test.ts` — `getNamesByUserIds`: skips when not phone-verified; skips when all cached; merges results into `userIdToNamesMap`; `clear()` resets the map
- [x] 6.3 `test/features/friendships/presentation/components/friend-requests-sheet.test.ts` — covers:
      - incoming row renders phone-only primary when RPC returned null firstName
      - incoming row renders "First Last" primary + lighter phone secondary when name resolved
      - outgoing row renders local-contact name primary + lighter phone secondary when contact matches phone
      - outgoing row renders phone-only when no local contact matches
      - accept flow: `addContact` called with profile name when RPC returns non-empty firstName; falls back to formatted phone when null; skipped when contact already exists for phone

## 7. Finalize

- [x] 7.1 Run `npx eslint . --fix` — must end with zero warnings
- [x] 7.2 Run `npm run type-check`
- [x] 7.3 Run `npm run test` — all green
- [x] 7.4 Prompt user to commit with conventional commit message:
      `feat(friendships): use profile first/last name when accepting request (#162)`
- [x] 7.5 Prompt user to push branch and open PR against `main`; PR body references issue #162 and notes the new migration requires `supabase db push` at deploy time
