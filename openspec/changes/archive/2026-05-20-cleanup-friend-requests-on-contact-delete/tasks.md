## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/143-cleanup-friendships-on-link-break`

## 2. Database Migration

- [x] 2.1 Ensure local Supabase running: `supabase start`
- [x] 2.2 Create new migration: `supabase migration new cleanup_friend_requests_and_friendships_on_link_break`
- [x] 2.3 Implement helper trigger function `terminate_pending_and_friendship_between(actor uuid, peers uuid[])` (SECURITY DEFINER) that:
  - DELETEs `friendships` rows where `(request_user_id = actor AND response_user_id = ANY(peers))` OR `(response_user_id = actor AND request_user_id = ANY(peers))`
  - UPDATEs `friend_requests` setting `status='cancelled', responded_at=now()` where `from_user_id = actor AND to_user_id = ANY(peers) AND status='pending'`
  - UPDATEs `friend_requests` setting `status='denied', responded_at=now()` where `to_user_id = actor AND from_user_id = ANY(peers) AND status='pending'`
- [x] 2.4 Implement trigger function `cleanup_on_contact_delete()` (SECURITY DEFINER): collect all phone `contact_methods` of `OLD.id`, call `find_users_by_phones` to get matched user IDs, then call the helper with `(OLD.user_id, matched_ids)`
- [x] 2.5 Attach trigger `BEFORE DELETE ON public.contacts FOR EACH ROW EXECUTE FUNCTION cleanup_on_contact_delete()`
- [x] 2.6 Implement trigger function `cleanup_on_contact_method_delete()` (SECURITY DEFINER): when `OLD.method_type = 'phone'`, look up matched user via `find_user_by_phone(OLD.value)`, fetch contact owner via `SELECT user_id FROM contacts WHERE id = OLD.contact_id`, then call the helper with `(owner, ARRAY[matched])` (no-op if `matched IS NULL`)
- [x] 2.7 Attach trigger `BEFORE DELETE ON public.contact_methods FOR EACH ROW WHEN (OLD.method_type = 'phone') EXECUTE FUNCTION cleanup_on_contact_method_delete()`
- [x] 2.8 `CREATE OR REPLACE FUNCTION public.delete_own_phone()` (preserve existing body) and add at the end (before clearing the phone, so we can still use `auth.uid()` consistently): DELETE all `friendships` where caller is a party; UPDATE pending `friend_requests` per the cancelled/denied rule
- [x] 2.9 GRANT EXECUTE on new functions to `authenticated`, `anon`, `service_role` (mirror existing convention); ensure `delete_own_phone()` retains its current grants
- [x] 2.10 `supabase db reset`; verify migration runs clean
- [x] 2.11 Manual SQL sanity checks (per break-point, both directions):
  - contact delete with pending outgoing → row `cancelled`
  - contact delete with pending incoming → row `denied`
  - contact delete with existing friendship → friendship row gone
  - contact_method (phone) delete → same three checks
  - `select public.delete_own_phone()` with mixed friendships + pendings → all caller rows cleaned

## 3. Frontend: Pre-Delete Detection Helpers

- [x] 3.1 In friendships store, expose derived helpers:
  - `pendingRequestUserIds`: Set<userId> over outgoing+incoming pending
  - `friendshipUserIds`: Set<userId> over friendships
- [x] 3.2 In `src/features/contacts/presentation/stores/contacts-store.ts`, add `relationshipsForContact(contactId)` returning `{ hasPending: boolean, hasFriendship: boolean }`:
  - gather contact's phone `contact_methods`
  - `friendshipRepository.findUsersByPhones(phones)` → matched user IDs
  - cross-check against the friendships-store sets
- [x] 3.3 Add `relationshipsForPhone(phone)` helper: `findUserByPhone` then cross-check
- [x] 3.4 In user store (or friendships store), add `currentUserHasAnyRelationship()` returning `{ hasPending: boolean, hasFriendship: boolean }`

## 4. Frontend: Confirmation UI

- [x] 4.1 In `src/features/contacts/presentation/components/contact-detail-view.vue`, before showing delete-contact confirmation: load friendships + pending if not loaded, call `relationshipsForContact`, conditionally render localized warning(s)
- [x] 4.2 In the phone contact-method delete flow (locate via `grep -rn "contact_method\|removePhone\|deletePhone" src/features/contacts/presentation`), call `relationshipsForPhone`, conditionally render localized warning(s)
- [x] 4.3 In the user-profile delete-own-phone component (already shows reverify disclaimer per commit #157), call `currentUserHasAnyRelationship`, append localized relationship warning(s) to the existing disclaimer
- [x] 4.4 Add i18n keys to `src/i18n/locales/en.json` and `src/i18n/locales/de-CH.json`:
  - `contacts.delete.pendingRelationshipWarning` (covers pending request and/or friendship variants — use ICU select or 3 sub-keys)
  - `contactMethods.delete.pendingRelationshipWarning`
  - `user.deletePhone.pendingRelationshipWarning`
- [x] 4.5 Wire keys via `t(...)`; choose variant based on `{ hasPending, hasFriendship }`

## 5. Tests

- [x] 5.1 Unit-test `relationshipsForContact` in contacts-store spec — mock repo + friendships store; cover: no phones, phones with no match, match with no relationship, match with pending only, match with friendship only, match with both
- [x] 5.2 Unit-test `relationshipsForPhone` — cover: unregistered phone, registered no relationship, registered with pending, registered with friendship, registered with both
- [x] 5.3 Unit-test `currentUserHasAnyRelationship` — cover: empty store, only pending, only friendships, both
- [x] 5.4 Component test for contact-detail-view: warnings render conditionally for each `{ hasPending, hasFriendship }` permutation
- [x] 5.5 Component test for delete-own-phone profile dialog: reverify disclaimer always present; relationship warning shown only when applicable
- [x] 5.6 Manual SQL verification steps documented above (task 2.11); all three break-points verified against local Supabase

## 6. Finalize

- [x] 6.1 `npx eslint . --fix` — zero warnings
- [x] 6.2 `npm run type-check`
- [x] 6.3 `npm run test` — all green
- [x] 6.4 Prompt user to commit (do NOT run `git commit`). Suggested message: `feat(friendships): auto-cleanup friendships and pending requests on link break (#143)`
- [x] 6.5 Prompt user to push branch and open PR; reference issue #143
- [x] 6.6 After merge & verification on preview, prompt user to run `supabase db push` to apply migration to prod
- [x] 6.7 Prompt user to archive this change via `/opsx:archive`
