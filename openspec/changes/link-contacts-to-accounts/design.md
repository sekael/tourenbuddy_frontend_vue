## Context

TourenBuddy stores contacts as user-owned rows with one or more phone methods. Phone verification (SMS OTP via Supabase Phone Auth + Twilio) already exists and sets `auth.users.phone_confirmed_at`. Issue #21 asks for friendship discovery using verified phone numbers as the trust anchor.

Cross-cutting: touches DB schema, RLS, an RPC, the contacts feature (store + UI), the import flow, and a new friendships feature. Privacy-sensitive: phone numbers must not be enumerable by unverified users.

## Goals / Non-Goals

**Goals:**

- Verified-to-verified discovery only — both parties' phones confirmed
- Adding a contact (manual or import) whose phone matches an account triggers an opt-in friend request prompt
- Recipient explicit accept/deny; deny does not block keeping the contact
- Friendship visible as icon in contacts list
- All friendship state survives contact deletion (friendship is between users, not contacts)

**Non-Goals:**

- Friend tour visibility, friend notifications on tour activity (later issues)
- Push notifications for incoming requests (in-app pull only for v1)
- Bulk-discovery sweep across whole contact book — match runs only at add/import time per number
- Unfriending/blocking UI (record schema supports it; UI deferred unless trivial)
- Group chat or messaging

## Decisions

### Phone-based discovery via SECURITY DEFINER RPC, not direct table read

`auth.users` is not directly queryable from the client. A `find_user_by_phone(phone text)` RPC SHALL run as SECURITY DEFINER and:

1. Reject unless the calling user has `phone_confirmed_at` set
2. Look up `auth.users` where `phone = $1 AND phone_confirmed_at IS NOT NULL`
3. Return only `{ user_id: uuid }` (or null) — no name, no phone echo, no profile data

Rationale: prevents phone-number enumeration by unverified users; returns minimum identity to anchor a friend request. Alternative considered: a public `verified_phone_directory` view — rejected because it exposes the full set to scraping.

Rate limiting: rely on Supabase per-user request quotas for v1; if abused, add a per-caller token-bucket via RPC counter table.

### Friendship data model

Two tables, both keyed by `(user_a_id, user_b_id)` with `user_a_id < user_b_id` invariant to dedupe:

- `friend_requests`: `id`, `from_user_id`, `to_user_id`, `status` (`pending`|`accepted`|`denied`|`cancelled`), `created_at`, `responded_at`. Unique index on `(from_user_id, to_user_id) WHERE status = 'pending'` to prevent duplicates.
- `friendships`: `user_a_id`, `user_b_id` (PK pair, ordered), `created_at`, `request_id` (FK).

Accept flow: transaction sets request `accepted` and inserts ordered pair into `friendships`. Deny: just updates request row. Either side may cancel a pending outgoing request.

Alternative considered: single `friendships` table with `status` column. Rejected — accepted-friendship reads are the hot path; keeping requests separate keeps that index lean and simplifies RLS.

### RLS

- `friend_requests`: SELECT allowed when `auth.uid() IN (from_user_id, to_user_id)`. INSERT requires `from_user_id = auth.uid()` AND caller's `phone_confirmed_at IS NOT NULL` AND target user's `phone_confirmed_at IS NOT NULL`. UPDATE: caller is `to_user_id` (accept/deny) or `from_user_id` with status `pending → cancelled`.
- `friendships`: SELECT allowed when `auth.uid() IN (user_a_id, user_b_id)`. No client INSERT/UPDATE/DELETE — only the SECURITY DEFINER `accept_friend_request(request_id)` function writes here.

### Discovery trigger points

- Manual contact form: on phone field blur (debounced) for any phone with successful E.164 normalization, call `find_user_by_phone`. If hit, show inline "TouringBuddy user — connect?" prompt.
- vCard / device import results: after parse, batch-call discovery for each unique normalized phone in the result set. Matched rows render the connect prompt next to the row.
- Re-discovery on existing contacts is out of scope. Hooking into `contacts` store on first-load to check all is feasible later.

Caller's own phone SHALL be filtered out of matches (no self-friending).

### Friendship icon in contacts list

Contacts store gains a derived `friendUserIdByContactId` map by joining its phone methods against the `friendships` table on app load. Contact list row shows a Material Symbols `group` (or `handshake`) icon when present. No icon during pending request — only on accepted friendship. (Pending state surfaces in the dedicated friend-requests UI.)

### Friend-requests inbox UI

Minimal v1: a list view at `/friends/requests` (or a section in profile) showing incoming pending requests with Accept / Deny buttons and outgoing pending with Cancel. Polled on focus; no realtime.

### Frontend module layout

```
features/friendships/
  data/
    models/                 # zod: FriendRequest, Friendship
    repositories/           # supabase impl
    services/               # find_user_by_phone RPC wrapper
  domain/
    entities/
    repositories/           # interface
  presentation/
    stores/                 # useFriendshipsStore (requests + friendships)
    pages/                  # FriendRequestsPage.vue
    components/             # ConnectPrompt.vue, RequestRow.vue
```

Cross-feature: `contacts` presentation imports `useFriendshipsStore` for the icon and the connect prompt. `contact-device-import` results component composes `ConnectPrompt`.

### i18n

New keys under `friendships.*` (prompt copy, accept/deny, request states, list empty state). Added to `en.json` and `de-CH.json`.

## Risks / Trade-offs

- [Phone-number enumeration via RPC] → Gate by caller's verified-phone status; return only opaque user_id; consider adding RPC rate-limit table if abused.
- [Race: two users add each other simultaneously] → Unique partial index on pending `(from,to)` and check for existing accepted friendship inside `accept_friend_request` (idempotent).
- [User changes phone after friendship exists] → Friendship persists (it's user-to-user). New phone becomes discoverable; old phone no longer matches.
- [Privacy: target user learns their phone is in requester's contacts] → Acceptable per issue (this is exactly the desired UX), but copy must make it clear who sent the request.
- [Latency on import with many matches] → Batch RPC `find_users_by_phones(text[])` to avoid N round-trips for the import case.
- [Stale friendship icon when request accepted on other device] → Refresh friendships on focus / on auth state change; full realtime deferred.

## Migration Plan

1. Apply DB migration (tables + RLS + RPC functions) — additive, no breaking change to existing data.
2. Ship frontend behind no flag (feature is opt-in by user action; pre-verified users see no change). Unverified users see no UI at all.
3. Rollback: drop new tables and RPCs; frontend code paths are isolated to new files plus a small contact-list icon hook that can be no-op'd.

## Open Questions

- Notification surface for incoming requests beyond the inbox page — banner in app bar? Defer until v1 lands and we observe usage.
- Should denying a request hide future re-requests for some cooldown? Defer; record `denied` request and let UX decide later.
