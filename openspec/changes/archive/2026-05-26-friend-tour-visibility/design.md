## Context

Tours today are owner-scoped: `tours` and `tour_partners` RLS allow only `user_id = auth.uid()`. The app reads tours through `tours_view` filtered client-side by `user_id`. Friendships already exist (`friendships`, `friend_requests`), and `tour_partners` links a tour to the owner's address-book `contacts`. A contact's identity as a *registered user* is not an FK — it is derived by matching the contact's verified phone against `auth.users.phone` (the `find_users_by_phones` / cleanup-trigger pattern, normalizing with `ltrim('+')`). Notifications use a client→Worker fire-and-forget call (`notify-dispatch.ts` → `services/email-hook`), resolving recipient prefs + Brevo template server-side with the service role.

This change broadens tour reads to friends, adds a per-tour `visibility` setting, gates sensitive columns for non-partner friend viewers, and notifies friend partners on shared-tour changes.

## Goals / Non-Goals

**Goals:**
- Per-tour `private`/`friends` visibility, owner-controlled, default `friends`.
- Friends read each other's `friends`-visible tours; private tours stay owner-only.
- Non-partner friend viewers get partner names, `planned_date`, `gpx_filepath` withheld (raw `partner_ids` are never exposed to any friend).
- Friend partners notified on shared-tour create/edit/delete, honoring existing prefs.
- A relation model that also serves the future `public` visibility state.

**Non-Goals:**
- The `public` visibility value (only `private`/`friends` now; enum left extensible).
- Realtime push of friend-tour changes (friend tour list refreshes on open/refetch; live sync deferred to follow-up issue #198).
- Editing another user's tour — friends remain read-only on owners' tours.
- A materialized tour↔user participation table.

## Decisions

### 1. Two-layer authorization: row RLS vs. detail gating
Row visibility is decided purely by `friendship(owner, viewer)` AND `tours.visibility = 'friends'` — **no partner resolution in the RLS predicate**. Detail gating (hiding `partner_ids`/`planned_date`/`gpx_filepath`) is a separate concern handled in the read view, because RLS is row-level and cannot null individual columns.
- *Why:* keeps the hot RLS predicate cheap (a friendship lookup), and isolates the expensive phone-based partner resolution to the gating layer only.
- *Alternative rejected:* resolving partner status inside the RLS `USING` clause — per-row phone joins on every tour query, and still can't gate columns.

### 2. Live partner resolution, no materialized table
Partner-as-user is resolved live: `tour_partners → contacts → contact_methods(phone) → auth.users` via a `security definer` helper (e.g. `tour_partner_user_ids(tour_id) returns uuid[]`), reusing the existing phone-normalization. Gating compares `auth.uid()` against that set.
- *Why:* `contacts` and `tour_partners` change independently of `tours`; a live derivation is always correct and avoids trigger maintenance across `tour_partners`, `contact_methods`, `contacts`, and `friendships` mutations. Gating is the only consumer, so per-query cost is acceptable at expected tour counts.
- *Alternative rejected:* `tour_participant_users(tour_id, user_id)` link table maintained by triggers — faster reads but four mutation points to keep consistent for a benefit only the gating layer needs.

### 2a. Partners shown to friends are registered users, by name
`partner_ids` are the owner's private contact UUIDs — meaningless and unresolvable in a friend's address book, and the owner's non-registered contacts must not leak. So the friend-read view does NOT return `partner_ids`; it returns the **registered-user partners** resolved from each partner contact's phone, surfaced as profile names. Non-registered address-book contacts are omitted entirely. The owner's own view keeps rendering partners from their address book unchanged.
- *Why:* the existing `tour-info-sheet` resolves `partnerIds` against the *viewer's* contacts store, which is empty for a friend's tour; and exposing raw owner contact names would leak private address-book data.
- *Resolver choice:* names come from a **tour-scoped** `SECURITY DEFINER` resolver `tour_partner_names(tour_id)` that self-authorizes (caller must be a partner on a `friends`-visible tour they are a friend of the owner on) and then returns the whole roster. It deliberately does **not** reuse `get_user_names_by_ids` — that one is **caller-relationship-scoped** (returns only profiles the *caller* is friends with, and excludes the caller), which wrongly filtered every co-partner out, since co-partners are friends of the *owner*, not each other. `get_user_names_by_ids` remains in use for its intended friend-name lookups (friend requests, owner labels).
- *Self label:* the viewer's own entry in the roster is rendered as "Me" (i18n `tours.infoSheet.partnerSelf`) in both the info sheet and the list row, rather than their own name.

### 2b. GPX + attachment access enforced at the storage layer
The `tour-gpx` and `tour-attachments` buckets are owner-only (`split_part(name,'/',1) = auth.uid()`), so gating paths in the view is insufficient — the object fetch itself is blocked. Add a storage `SELECT` policy on each bucket permitting a partner-friend (friendship + `visibility='friends'` + partner via the same helper) to read the object; non-partner friends and private tours stay blocked at storage. Attachments additionally need a partner-friend `SELECT` policy on the `tour_attachments` **metadata table** (otherwise the strip queries zero rows and never reaches storage); attachment writes stay owner-only.

### 3. Friend reads go through a `security_invoker` view/RPC
The existing `tours_view` is owned by `postgres` with no `security_invoker` set, so it does **not** reliably enforce base-table RLS. Friend reads MUST run with the caller's privileges so the new friend RLS policy filters rows. Decision: expose friend tours through a `security_invoker = true` view (or `security definer` RPC that itself re-checks friendship), applying column gating in SQL using `tour_partner_user_ids()` and `auth.uid()`. Own-tour reads stay on their current path.
- *Why:* prevents a definer view from leaking all tours; centralizes gating in one SQL surface the client cannot bypass.
- *Action:* verify/lock the security mode of any view used for friend reads (covered in tasks + tests asserting a non-friend gets zero rows).

### 4. `visibility` as text + check constraint
Add `tours.visibility text NOT NULL DEFAULT 'friends'` with `CHECK (visibility IN ('private','friends'))`, mirroring the existing `tour_type` check pattern. Owner-only writes enforced by the existing owner UPDATE policy.
- *Why:* consistent with current schema conventions; trivially extensible to add `'public'` later via a new migration.

### 5. Notifications: client→Worker, mirroring friend requests
After a successful tour create/edit/delete, the client calls a new `notifyTourChanged(tourId, action)` → `POST /notify/tour-changed`. The Worker (service role) loads the tour's partner user IDs, intersects with the owner's friends, excludes the actor, and dispatches per recipient honoring `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types` for the new `tour_updates` type, using one generic localized Brevo template.
- *Why:* reuses the proven, debuggable friend-request dispatch path; notification failure never blocks the write (fire-and-forget).
- *Alternative rejected:* Postgres trigger → `pg_net` → Worker — more infra, fires on non-UI writes, harder to debug, harder to compute "meaningful edit".

### 6. Meaningful-edit filtering on the client
The client knows old vs. new tour state, so it decides whether a partner-facing field changed before dispatching an edit notification. Partner-facing set: **name, planned_date, goal location, tour_type, partners, completion flip, GPX added/changed, description, equipment** (description + equipment included as mission-critical mountain detail). Excluded: notes, elevation, seasons, start/end-point detail. Switching to `private` does not notify — the tour just stops being friend-visible. On confirming a duplicate save, B's new tour fires the standard "created" notification to A even though A owns the colliding original (no special suppression — it is a genuinely new shared tour).
- *Why:* avoids noisy notifications for cosmetic/owner-private edits without the Worker needing change history.

### 8. Tour-interest Worker authorization
`/notify/tour-interest` is called by the *declining* friend (not the owner). The Worker (service role) loads the tour, verifies an accepted friendship between caller and owner AND `visibility='friends'`, then notifies the owner only, naming the caller. It does NOT re-verify the 100m collision (client-trusted UX trigger) or partner status (interest is precisely the non-partner/decline path).
- *Why:* the friendship check prevents strangers spamming interest pings; collision/partner are UX concerns the server need not re-derive.

### 9. Blocking already revokes visibility
Blocking a user calls `terminate_pending_and_friendship_between`, deleting the friendship. Since friend tour RLS keys on the `friendships` table, a block automatically revokes tour visibility and stops shared-tour notifications — no extra work needed in this change.

### 7. Collision handling: client-side detection, map-only precedence
A 100m goal-collision radius defines "same objective", computed client-side with the existing `features/tours/domain/distance.ts` haversine helper against the tours the client already holds. Two distinct behaviors:
- **Duplicate prompt:** when B creates a tour colliding with a friend tour *on which B is a partner*, prompt to save a duplicate. Confirm → normal shared-tour create (fires the standard `tour_updates` notification to the friend). Decline → no save, dispatch a `tour_interest` notification to the colliding tour's owner.
- **Map precedence:** when an owned tour and a friend tour collide, the owned marker is rendered and the friend marker suppressed in the map source build. The friend tour is untouched in the Friends list tab (no data hiding, just map dedup).
- *Why:* collision is a presentation/UX concern over data the client already has; no server schema. `tour_interest` is a separate notification type so users can mute interest pings independently of shared-tour changes.
- *Alternative rejected:* server-side collision detection / a `tour_interest` row table — unnecessary; the interest signal is a fire-and-forget notification, not persisted state.

## Risks / Trade-offs

- **Definer view leaks all tours** → friend reads use `security_invoker` (or an RPC that re-checks friendship); add a test asserting a non-friend reading the friend view/RPC gets zero rows.
- **Per-query phone resolution cost** in gating → resolve once per tour via the helper; rely on existing phone indexing; revisit with a materialized table only if profiling shows a problem.
- **Phone-match fuzziness** (formatting/country code) → reuse the exact normalization (`ltrim('+')`) already used by `find_users_by_phones` and the cleanup triggers, so partner resolution matches friendship resolution.
- **Default `friends` exposes existing tours** → on deploy, all current tours become friend-visible. Accepted per product decision (default `friends`); called out so it is a conscious choice, not a surprise. No backfill to `private`.
- **Notification spam on rapid edits** → meaningful-field filter plus client-side coalescing of a save burst.
- **Worker needs owner contacts/phones** (RLS-protected) → Worker uses the service role, as it already does for friend-request resolution.

## Migration Plan

Four migrations land in order (all applied locally via `supabase db reset`, verified with the RLS test script, then `supabase db push` — prompted, never unprompted):

1. `…_add_tours_visibility`: `tours.visibility` column + check constraint (default `friends`); expose in `tours_view`.
2. `…_friend_tour_read_access`: friend `SELECT` policy on `tours` (friendship AND `visibility='friends'`); `tour_partner_user_ids()` `security definer` helper; `friend_tours_view` (`security_invoker`) with column gating; `tour-gpx` partner-friend storage policy. (No `tour_partners` friend policy — the view resolves partners via the helper and never returns raw `contact_id`s.)
3. `…_fix_friend_tour_partner_names`: tour-scoped `tour_partner_names()` resolver; recreate `friend_tours_view` to use it (the original `get_user_names_by_ids` was caller-scoped and returned no names).
4. `…_friend_attachment_access`: partner-friend `SELECT` policies on `tour_attachments` (table) and the `tour-attachments` storage bucket.

Frontend + Worker + i18n ship together; Worker `tour-changed` / `tour-interest` endpoints + Brevo template env vars added to the Worker secrets (via `wrangler`) and frontend `VITE_*` to the GitHub Actions env step + repo secrets.
- *Rollback:* drop friend policies/views (reads revert to owner-only); the `visibility` column can remain harmlessly. Worker endpoints are additive.

## Open Questions

- Whether the Friends list tab should paginate / lazy-load if a friend has many tours (defer unless needed).
