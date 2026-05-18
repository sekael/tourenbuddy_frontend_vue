## Why

The friend-request inbox today renders each pending or accepted-but-not-yet-contacted user as a raw E.164 phone string, and the contact auto-created on accept also stores the phone as the contact's first name. Recipients have no way to know who is asking to be friends without opening their email notification, and accepted friends land in the address book as nameless phone-number entries. We need both the inbox view AND the auto-created contact to use the requester's actual first/last name from `user_profile`.

## What Changes

- New Supabase RPC `public.get_user_names_by_ids(p_user_ids uuid[])` returns `(user_id, first_name, last_name)`. Disclosure gating: caller is phone-verified AND (caller is a confirmed friend of target OR caller is the `to_user_id` of a pending `friend_requests` row with target). The pending-request branch is limited to the recipient direction — names are disclosed to the person being asked, not to the asker, because the email notification already reveals the sender's name to the recipient out-of-band.
- `FriendshipRepository` + Pinia store gain `getNamesByUserIds(ids)`; store caches results in a `userIdToNamesMap`.
- `friend-requests-sheet.vue` inbox redesign:
  - **Incoming rows** show the requester's `user_profile` first/last name (resolved via the new RPC) on top with the phone rendered below in a lighter color so the recipient can double-check the number. Falls back to phone-only when profile name is null/empty.
  - **Outgoing rows** show the recipient's name from the sender's **local contacts** (matched by phone) on top, with the phone below in lighter color. No RPC call — uses `contactsStore.contacts`. Falls back to phone-only when no local contact matches.
- Accept handler (recipient side) creates the new contact via `addContact(firstName, lastName, null, [{phone, isPrimary}])` using the requester's profile name. Fallback to phone-as-firstName when profile name is null/empty.
- Accept handler (sender side) does NOT modify the sender's existing local contact — the user-chosen name wins over the recipient's profile name.
- Sender disclaimer (`friendships.prompt.securityNote`) kept and extended in both locales: sender is informed their name becomes visible to the recipient (still useful even though email reveals it — covers deny-without-open).
- Recipient `acceptWarning` unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `friendships`: Inbox shows resolved names alongside phones for both directions; accept flow auto-creates a contact with the requester's profile name; new name-resolution RPC contract with friendship + recipient-of-pending-request gating.
- `contacts`: No store-level behavior change. Accept-driven contact creation now passes real first/last name rather than phone. Documented as a clarification of the friendship integration.

## Impact

- **Code**: `src/features/friendships/{data,domain,presentation}/**`, `src/features/friendships/presentation/components/{friend-requests-sheet,connect-prompt}.vue`, `src/locales/{en,de-CH}.json`, `test/features/friendships/**`.
- **Database**: New migration file `supabase/migrations/<timestamp>_get_user_names_by_ids.sql` produced by `supabase migration new` (baseline untouched per immutable-migrations rule). Prod rollout: `supabase db push` applies un-applied migration files in timestamp order.
- **APIs**: New `get_user_names_by_ids` RPC. No existing RPC signatures change.
- **Privacy**: Name disclosure widened to "recipient of a pending request" (sender→recipient leak only). Sender never learns the recipient's profile name from the server pre-accept; outgoing UI uses the sender's own local contacts.
- **No backfill**: Existing contacts created via prior accepts keep their phone-as-name; only future accepts get profile names.
