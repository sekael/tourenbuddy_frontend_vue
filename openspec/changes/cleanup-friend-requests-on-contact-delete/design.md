## Context

A `friendships(A, B)` row models a mutual relationship that, in this app, is only meaningful while both users possess a verified phone (`auth.users.phone_confirmed_at IS NOT NULL`) AND have each other in their `contacts` via that verified phone. Today the relationship is created via `accept_friend_request` and torn down only via the explicit `remove_friendship` RPC. Pending `friend_requests` are torn down only via explicit user action (`cancel`, `deny`). None of the three break-points (contact delete, linking-phone delete, own-phone delete) trigger cleanup, leaving orphaned rows.

Relevant schema (`supabase/migrations/20260101000000_initial_schema.sql`):
- `friend_requests(id, from_user_id, to_user_id, status, created_at, responded_at)`; `status ∈ {pending, accepted, denied, cancelled}`; partial unique index `friend_requests_pending_pair_idx` on `(from_user_id, to_user_id) WHERE status = 'pending'`.
- `friendships(request_user_id, response_user_id, created_at, request_id)`; no status column; deletion = end of friendship.
- `contacts(id, first_name, last_name, display_name, user_id)`.
- `contact_methods(id, contact_id, method_type, value, is_primary, ...)`; FK to `contacts` `ON DELETE CASCADE`.
- `auth.users.phone` + `auth.users.phone_confirmed_at` hold the verified phone.
- Existing helpers: `find_user_by_phone`, `find_users_by_phones`, `find_phones_by_user_ids`, `is_phone_verified`, `remove_friendship`, `delete_own_phone`.

## Goals / Non-Goals

**Goals:**
- Atomically enforce the "linking verified phone" invariant: friendship + pending request rows MUST disappear the moment any of the three break-points fires.
- Preserve audit history for terminated `friend_requests` (status update, not delete).
- Surface a localized confirmation warning at every break-point so the user understands the side effect.

**Non-Goals:**
- Retroactive cleanup of already-orphaned `friendships` / pending `friend_requests` (out of scope; addressable via separate one-off data fix if needed).
- Reacting to peer-side changes (e.g., the *other* user reverifying with a different phone). The triggers fire only when the *actor* removes a contact / phone / own-phone.
- Changes to the existing `accept_friend_request` / `remove_friendship` RPCs or to `friend_requests` lifecycle for actions other than the three break-points.

## Decisions

### D1. Database triggers + SECURITY DEFINER function modification (vs. client orchestration)
**Chosen:**
- Two `BEFORE DELETE` triggers — one on `contacts`, one on `contact_methods` (filtered to `method_type = 'phone'`).
- `CREATE OR REPLACE` of `public.delete_own_phone()` to extend it with friendship + pending-request cleanup for the caller.

**Rationale:**
- Atomic with the destructive action; no client-side drift risk.
- `delete_own_phone()` already exists as SECURITY DEFINER — extending it keeps own-phone teardown in one place. A trigger on `auth.users` would also work but is more invasive (Supabase-managed schema).
- Set-based UPDATE / DELETE keeps cost low on Supabase free tier.

**Alternative:** Trigger on `auth.users` `AFTER UPDATE` filtered to `phone_confirmed_at` transitioning to NULL — rejected: touching `auth` schema triggers is brittle across Supabase upgrades; current `delete_own_phone()` is the single intended entry point.

### D2. Cleanup semantics: friendships vs friend_requests
**Chosen:**
- `friendships`: hard DELETE (no status column exists; deletion is the canonical lifecycle end).
- `friend_requests` with `status = 'pending'`:
  - If actor (contact owner / phone-deleting user) = `from_user_id` → `status = 'cancelled'`.
  - Else (actor = `to_user_id`) → `status = 'denied'`.
  - `responded_at = now()`.
- Non-pending `friend_requests` rows are NOT modified. (`accepted` rows correspond to live `friendships` and are torn down via the friendships DELETE; `denied` / `cancelled` are terminal historical records.)

**Rationale:**
- Mirrors today's user-initiated semantics (sender cancels, recipient denies).
- Partial unique index `friend_requests_pending_pair_idx` covers `status = 'pending'` only — terminal rows do not block re-sends.

### D3. Scope of cleanup at each break-point

| Break-point | friendships cleaned | friend_requests cleaned (pending only) |
|---|---|---|
| `contacts BEFORE DELETE` | row(s) between contact owner and any user matched via the contact's phone `contact_methods` | same pairs |
| `contact_methods BEFORE DELETE` (`method_type='phone'`) | row(s) between contact owner and user matched via `OLD.value` | same pair |
| `delete_own_phone()` (caller = A) | every row where A is `request_user_id` OR `response_user_id` | every pending row where A is `from_user_id` OR `to_user_id` |

For the own-phone case, "verified" is implicit: only verified phones can land in `auth.users.phone_confirmed_at`. For contact / contact_method cases, the match runs via existing `find_users_by_phones`/`find_user_by_phone` which already require the matched side to have a verified phone.

### D4. SECURITY DEFINER on trigger functions
Trigger functions run as `SECURITY DEFINER`, owned by `postgres`. Necessary because the deleter's RLS view of `friendships` / `friend_requests` may not include every row (it always does today, but defensive). Functions are tightly scoped: WHERE clauses always require one side of the pair to equal the actor (contact owner or `auth.uid()`). No user input enters the WHERE clause — only the actor's identity and resolved user IDs.

### D5. Phone resolution inside triggers
Trigger functions call the existing `find_user_by_phone` / `find_users_by_phones` helpers rather than duplicating normalization logic. Single source of truth.

### D6. Client UX: pre-delete detection + warning
The DB is the source of truth; the client pre-check is informational, surfaced through extended confirmation dialog text. Three detection helpers:
- `hasPendingRequestOrFriendshipForContact(contactId)` — gather contact's phones → `findUsersByPhones` → for each matched userId check pending request OR friendship presence.
- `hasPendingRequestOrFriendshipForPhone(phone)` — single-phone variant.
- `hasAnyPendingRequestOrFriendship()` — for the user profile own-phone delete; returns true if the current user has any pending request or friendship row.

Each break-point UI conditionally renders the appropriate localized warning. The own-phone delete already has a reverify disclaimer (per recent commit `feat(user): allow deleting phone number with reverify disclaimer (#157)`); we extend that disclaimer.

i18n keys (added to `en.json` and `de-CH.json`):
- `contacts.delete.pendingRelationshipWarning`
- `contactMethods.delete.pendingRelationshipWarning`
- `user.deletePhone.pendingRelationshipWarning`

## Risks / Trade-offs

- **[Risk]** `SECURITY DEFINER` broadens write rights on `friendships` and `friend_requests`. → **Mitigation:** WHERE clauses are fixed; actor identity comes from `OLD.user_id` / `auth.uid()`, never from user-supplied parameters. Functions only delete `friendships` rows where one side equals the actor and only update `friend_requests` rows where `status = 'pending'`.
- **[Risk]** Extending `delete_own_phone()` widens its blast radius (was: clear auth phone; becomes: clear auth phone + delete friendships + cancel/deny pending). → **Mitigation:** new behaviour is documented and exposed only through the same RPC; client warning is updated so user consent is explicit.
- **[Risk]** Client pre-check is stale (store not refreshed) → user sees "no relationships" warning while DB cleans something up. → **Mitigation:** before opening the confirmation dialog, refresh the relevant store (friendships + pending requests). Pre-check is best-effort; DB trigger is authoritative.
- **[Risk]** Many phones per contact → trigger does extra work. → **Mitigation:** single set-based UPDATE/DELETE per trigger fire; contact phone counts are tiny.
- **[Trade-off]** Pre-existing orphaned rows not retroactively cleaned. Acceptable as documented in Non-Goals.

## Migration Plan

1. `supabase migration new cleanup_friend_requests_and_friendships_on_link_break` — generate new migration file.
2. Implement trigger functions + triggers on `contacts` and `contact_methods`.
3. `CREATE OR REPLACE FUNCTION public.delete_own_phone()` with the same body as today + friendship/pending cleanup.
4. `supabase db reset` locally; verify with manual SQL covering all three break-points.
5. Implement frontend helpers + extended confirmation warnings + i18n keys.
6. `npm run test`, `npx eslint . --fix`, `npm run type-check` all green.
7. After review and merge to `main`, prompt user to run `supabase db push` to apply migration to prod.
8. Rollback: forward-only — a follow-up migration restoring `delete_own_phone()` to its prior body and dropping the triggers + functions. Never edit existing migration files.
