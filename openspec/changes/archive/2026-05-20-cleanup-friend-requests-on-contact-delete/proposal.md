## Why

A `friendships` row (and any pending `friend_requests` between the same pair) is only meaningful while BOTH users still possess (a) a verified phone in `auth.users` and (b) the other party in their `contacts` linked via that verified phone. Today, none of the three break-points clean up: deleting a contact, deleting the contact's verified phone `contact_method`, or deleting one's own verified phone in the user profile all leave dangling `friendships` rows and stale pending `friend_requests`. Issue #143 was filed for the pending-requests symptom; the same root cause applies to accepted friendships.

## What Changes

- Define the "linking verified phone" invariant explicitly: `friendships(A, B)` requires both A and B to have a verified phone (`auth.users.phone_confirmed_at IS NOT NULL`) AND each to have the other in their `contacts` via that verified phone. When any of these conditions breaks, the system MUST remove the friendship and terminate any pending `friend_requests` between the pair.
- Add Postgres `BEFORE DELETE` trigger on `public.contacts` that, for each phone in the contact's `contact_methods`, resolves the linked verified-phone user and performs cleanup between the contact owner and that user.
- Add Postgres `BEFORE DELETE` trigger on `public.contact_methods` (where `method_type = 'phone'`) that performs the same cleanup scoped to the single removed phone.
- Extend `public.delete_own_phone()` to additionally remove all `friendships` rows in which the caller is a party and terminate all pending `friend_requests` rows in which the caller is sender or recipient — because once the caller's own phone is gone, no remaining friendship/pending row between the caller and any peer can satisfy the invariant.
- Cleanup semantics:
  - `friendships`: hard DELETE (no status column).
  - `friend_requests` with `status = 'pending'`: UPDATE to `status = 'cancelled'` if the actor (contact owner / phone-deleting user) is the `from_user_id`, else `status = 'denied'`; set `responded_at = now()`. Non-pending rows untouched. Partial unique index `friend_requests_pending_pair_idx` only covers `status = 'pending'`, so future re-sends remain possible.
- Client UX: every action that triggers cleanup MUST show a localized confirmation warning explaining that the pending friend request and/or existing friendship between the user and the affected peer(s) will be removed. This applies to:
  - Deleting a contact (existing confirmation, extended message)
  - Deleting a phone `contact_method` (existing confirmation, extended message)
  - Deleting one's own verified phone via the user profile (existing reverify disclaimer, extended message)

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `friendships`: friendship lifecycle gains automatic removal (and pending-request termination) triggered by contact deletion, linking-phone deletion, or own-phone deletion.
- `contacts`: deleting a contact must warn when the action will cancel pending requests or remove an existing friendship.
- `contact-methods`: deleting a phone contact-method must warn when the action will cancel pending requests or remove an existing friendship.
- `user-profile`: deleting one's own verified phone must warn when the action will cancel pending requests or remove existing friendships.

## Impact

- **Database**: new migration under `supabase/migrations/` adding two trigger functions on `contacts` / `contact_methods` and `CREATE OR REPLACE`-ing `delete_own_phone()` to perform the extra cleanup. Functions run with `SECURITY DEFINER`. No schema column changes.
- **Frontend**: pre-delete detection helpers added to contacts and user stores; existing confirmation UIs extended with conditional warning text. New i18n keys in `en.json` and `de-CH.json`.
- **No external API changes.** Existing RPCs (`find_user_by_phone`, `find_users_by_phones`, `is_phone_verified`) reused; no new RPC signatures.
- **Backward compatibility**: pre-existing orphaned `friendships` / pending `friend_requests` (created before this change) are not retroactively cleaned up by the migration. Acceptable: low expected count, manually removable via existing UI.
