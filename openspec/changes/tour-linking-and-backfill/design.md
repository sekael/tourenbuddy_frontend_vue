## Context

The codebase already has friend tour visibility, shared-tour notifications, and a duplicate-save dialog gated on a 100 m goal collision. The collision check lives client-side in `src/features/tours/domain/collision.ts` and `src/features/map/presentation/pages/map-page.vue`. The Worker (`services/email-hook`) authorizes per-event calls (friend request, tour change, tour interest) and dispatches push + email gated by `notif_push_enabled`, `notif_email_enabled`, and `notif_muted_types` on `user_profile`. There is **no in-app notification inbox**: delivery is push + email only, which is why a muted recipient sees nothing of the legacy "decline duplicate" interest signal.

This change replaces that ephemeral signal with a durable, opt-in linking primitive (N-way `tour_link_group`) plus an automatic Worker collision scan that fires on every tour save, and a friendship-accept backfill scan that emits a single digest per side. Links survive across page reloads, devices, and notification muting because they live in the database as their own resource. Collaboration-readiness (future real-time co-editing) is the long-term motivation.

## Goals / Non-Goals

**Goals:**
- Remove the social friction of forcing the owner to accept/decline a "duplicate save" implication.
- Make collision a **detected fact** that surfaces in the UI on both tours, decoupled from notification delivery.
- Support **N tours per group** from day one (forward-compatible to >2-friend collaboration).
- Provide a **reconciliation path** for pre-existing collisions surfaced by new friendships, batched into a single digest per side.
- Enforce link invariants in the database via triggers so the client cannot drift from the truth.
- Preserve the existing `tour_interest` enum, Brevo templates, and mute toggle (only labels and dispatch triggers change).

**Non-Goals:**
- Real-time collaborative editing of a single tour (linking unlocks it, this change does not deliver it).
- Absorb-style merging that destroys one tour and rolls it into another. Each owner keeps their own tour; links are siblings.
- Server-side auto-relinking when friendships are restored, types are aligned, or goals are moved back into the radius. Re-linking is always an explicit user action.
- In-app notification inbox/feed.
- Mobile-specific UI variants beyond what the existing shared components already provide.

## Decisions

### D1. Link model: N-way group via two tables, not self-FK

Use `tour_link_group(id, created_at)` + `tour_link_member(group_id, tour_id, joined_at)` with a unique constraint on `tour_id` so each tour belongs to at most one group. **Alternative considered:** a `linked_tour_id` self-FK column on `tours`. **Why rejected:** pair-only; cannot represent a 3-friend group without N rows and ambiguous semantics. Group table costs two small tables and one unique constraint, buys forward-compat with no logic change.

### D2. Handshake via dedicated `tour_link_request` table

A separate request table tracks the handshake explicitly, with status in `{pending, accepted, declined, withdrawn}` and a partial unique index on `(initiator_tour_id, target_tour_id) WHERE status='pending'`. **Alternative considered:** treat the membership row itself as the proposal, with a `confirmed_at` timestamp per member. **Why rejected:** muddles two concerns (proposal vs. membership), makes "withdrawn before acceptance" ambiguous, and complicates RLS (who can see an unconfirmed membership?). A dedicated request table keeps each row's purpose clear and lets RLS be expressed simply: "you can read/write requests referencing a tour you own."

### D3. Invariants enforced by DB triggers, not application code

All eviction conditions (goal moved >100 m from any sibling, tour_type changed, visibility flipped away from `friends`, friendship row deleted between member owners) are enforced by AFTER UPDATE / AFTER DELETE triggers in Postgres. The `friendships` table is binary (row exists = accepted; no `status` column), so the friendship-break trigger fires on **AFTER DELETE only** — no UPDATE branch. **Why:** the client cannot be the source of truth — a user could edit a friend tour via direct API call, friendship rows can be deleted by either side, and tour deletes already cascade. The trigger model guarantees the invariant holds whatever path produced the change. **Cost:** trigger correctness is harder to test than client code; we rely on Vitest-driven SQL fixtures for trigger scenarios and `supabase db reset` for repeatable local verification.

The same eviction triggers also **auto-void pending link requests** that reference the affected tour or broken friendship pair: AFTER any trigger that would evict a tour from a group, all `tour_link_request` rows in status `pending` involving that tour are moved to `withdrawn` with `resolved_at = now()`. This keeps pending requests in sync with the predicate at all times and prevents users from accepting a stale request whose underlying collision no longer holds.

### D4. Link request mutations via SECURITY DEFINER RPCs; Worker is dispatch-only

Per existing patterns (friendship rows, `tour_partners` rows), DB writes for linking are owned by the database, not the Worker. Specifically, four SECURITY DEFINER SQL functions form the public mutation surface:

- `create_link_request(p_initiator_tour_id uuid, p_target_tour_id uuid)` — validates caller owns initiator; re-validates the collision predicate (within 100 m + matching non-null `tour_type` + both friends-visible + mutual friendship); enforces "at most one side already in a multi-tour group" (see D11); inserts the row; returns `request_id`.
- `accept_link_request(p_request_id uuid)` — validates caller owns the target tour; re-validates the predicate and group-merge rule; atomically updates the request to `accepted`, resolves or creates the group, inserts membership row(s); returns `{group_id, added_tour_ids}`.
- `decline_link_request(p_request_id uuid)` — validates caller owns the target tour; updates row to `declined`.
- `withdraw_link_request(p_request_id uuid)` — validates caller owns the initiator tour; updates row to `withdrawn`.

Direct `INSERT`/`UPDATE` against `tour_link_request` and `tour_link_member` is blocked by RLS (`SELECT` only). **Why this shape rather than plain RLS-direct writes:** acceptance and creation each require multi-step validation + multi-row writes in one transaction; expressing that purely via RLS policies and client-side sequenced writes invites race conditions and partial states. RPCs give the call a single round-trip, an atomic transaction, structured return values, and named error codes. **Alternative considered:** a `/link-request/create` Worker endpoint that does the DB write. **Why rejected:** the Worker is a notification service; putting DB mutation logic there forces it to hold service-role privileges for ordinary user actions and duplicates RLS-equivalent checks in TypeScript.

### D5. Collision scan runs on every save, not only on creates

The Worker scans on both create and update because edits can produce new collisions (e.g. user moves the goal into a friend's tour radius). **Cost:** every meaningful tour update triggers a scan on top of the existing `tour_updates` dispatch. This is acceptable because the scan is bounded by friend count × visible tours and Cloudflare Workers handle the call within the same request budget as the existing `notifyTourChanged`. **Mitigation:** the scan excludes pairs already in the same group, so steady-state cost on linked tours is one cheap LEFT JOIN per edit.

### D6. Friendship-accept backfill: fold into existing `/notify/friend-request-responded` handler

When the requester taps Accept, the existing client → Worker `/notify/friend-request-responded` call already fires. Extend that **single** handler with two independent sub-routines: `dispatchRespondedNotification` (existing) and `dispatchBackfillDigest` (new). Each is wrapped in try/catch so failure of one cannot block the other. **Alternatives considered:** (a) a second client-fired endpoint (`/notify/friendship-backfill`) — adds client coordination and a race window; (b) Postgres `LISTEN/NOTIFY` + `pg_net` — adds operational complexity and a new failure mode. **Why rejected:** the Worker's responsibility is "all notification dispatch given an event," and both sub-routines fit that contract; folding them avoids client coordination without violating separation of concerns. The scan reads DB and dispatches; it performs zero business writes.

### D7. Keep `tour_interest` enum and Brevo templates; rewrite labels and copy only

The semantic shift ("decline-of-duplicate" → "same-tour collaboration suggestion") is real but the channel + mute + delivery surface is identical. **Alternative considered:** introduce a new `tour_link_request` enum value and split the mute toggle into two. **Why rejected:** doubles the user-facing toggle surface for a single conceptual category (collaboration suggestions), and forces a notif-prefs migration. Keeping the enum stable preserves muted-types data and keeps the mute UI single-row.

### D8. Eviction visibility: no automatic relinking after a sibling re-enters the radius

If a user edits the goal back into the 100 m radius after a previous eviction, the system does **not** auto-rejoin the group. A new link request is required. **Why:** auto-relink would surprise users (they may have moved the goal intentionally), and it muddies the "links are explicit acts of consent" invariant. The collision notice will reappear on the info sheet so re-link is one tap away.

### D9. Info-sheet UX: pills + notice + banner sections, no merged dual sheet

Per the proposal, each tour keeps its own info sheet; linking adds:
- one "Linked with [name]" pill per other group member (clicking opens that friend's sheet via existing tour-detail navigation),
- a collision notice with a "Request to link" action when there are not-yet-linked collisions,
- a link-request banner (incoming: Accept/Decline; outgoing: Withdraw).
**Why:** rendering more than two tours side-by-side in a single sheet (the N-way case) becomes cramped. Pills are a familiar pattern (we already use chip pills for partners), the redirect is friction-free, and each owner retains a clean information surface.

### D10. Eviction-warning dialog is client-side soft-gate, not a hard DB block

The DB trigger always evicts when the invariant breaks. The client shows a confirmation dialog before submitting a goal/type/visibility edit on a linked tour so the user knows their action will unlink them. **Why:** server-side rejection would block legitimate edits (a user might genuinely want to change tour type and accept the unlink); the right semantic is "warn, then permit." Matches the design language of the existing friendship/contact delete dialog.

### D11. Group growth, no group merging

A link request is valid iff **NOT (initiator's tour is in a multi-tour group AND target's tour is in a multi-tour group)** — i.e., at most one side may already be grouped. Effects:

- Both ungrouped → accept creates a new pair group.
- Exactly one side grouped → accept adds the ungrouped tour to that group (N → N+1).
- Both grouped (different groups) → reject with named error.

**Joining an existing group uses one-existing-member-accept.** C requests link with A's specific tour (the one it collides with); A's accept admits C into the group. Other members (B, …) are not re-prompted; their prior link participation is treated as implicit consent to future members that satisfy all invariants (friendship-with-all-members, visibility, type, goal). Trade-off accepted: per-pair re-consent would scale linearly with group size and undercut the platform's collaboration goal.

### D12. Realtime subscription scope

`tour-links-store` subscribes via Supabase Realtime to `tour_link_request` only (handshake feedback needs to feel live). Group membership state is refetched lazily on tour info-sheet open and on tour-list mount; eviction events arrive indirectly via the tour update events the tour store already subscribes to.

### D13. Group-membership-change notifications

Group membership transitions emit `tour_interest`-typed notifications to keep all opted-in participants in the loop. Specifically:

- **New member joins** (accept of a link request): notify each pre-existing member (the joiner already knows — they just got accepted).
- **External eviction** (sibling's edit, friendship break, evicted user's tour deleted): notify the evicted user AND remaining members.
- **Self-eviction via own confirmed edit**: skip the self-notify (the user just clicked through the warning dialog); still notify the remaining members.
- **Dissolution** (group count drops below 2): notify the lone remaining member that the group is gone.

All emissions honor the recipient's existing `notif_push_enabled`, `notif_email_enabled`, and `notif_muted_types` (including `tour_interest`). Brevo templates extended with parameter variants for the join / evicted / dissolved subtypes; no new top-level enum.

### D14. Backfill discovery fallback for muted users

Users who mute `tour_interest` won't receive the friendship-accept digest. To preserve a non-intrusive in-app discovery path, the friend profile page exposes a "Collisions ([N])" entry that opens the same `backfill-collisions-page` (filtered to the relevant friendship). The data already exists and the page is already built for the digest deeplink, so the wiring is a single profile-row component. **Why on the friend profile specifically:** it's a low-traffic surface already organized around "this specific friendship," matches the data scoping, and avoids cluttering the high-traffic friend tour-list with a badge.

### D15. Map marker chain overlay for linked tours

Tours rendered on the map whose row appears in `tour_link_member` show a small chain/link icon overlay on the marker. Owned-over-friend precedence (existing collision suppression) is unchanged — the rendered marker is always the owned one when a friend tour collides with it. Tap on the marker opens the existing tour info sheet, which already surfaces the full link / group state. **Why now and not deferred:** the overlay is a small marker layer add with no behavioral coupling, and surfacing linkage at the spatial level matches users' "which of my tours are collaborative?" mental model without forcing a sheet open to find out.

### D16. Delete-tour confirmation extension

The existing tour-delete confirmation dialog gains a conditional line of copy when the target tour is in a `tour_link_group`: "This tour is linked with [N] friend tour(s). Deleting will unlink them." No new dialog or flow — one `v-if` and one i18n key. Remaining group members are notified per D13.

## Risks / Trade-offs

- **Risk:** Friendship deletion in a 3-member group evicts both broken-pair owners' tours, even though one of them is still friends with the remaining members. → **Mitigation:** matches user-confirmed semantics ("simple invariant beats complex per-pair surgery"); the still-friends owner can request a fresh link.
- **Risk:** Worker collision scan adds a per-save call. → **Mitigation:** scan is bounded by friend count and runs in the existing fire-and-forget pattern; failures are logged client-side and never roll back a save.
- **Risk:** N-way groups invite UI sprawl as friend counts grow (10-member group → 9 pills). → **Mitigation:** pill section can collapse to "Linked with [name] +N more" if N>3, mirroring the existing "and X more" pattern for unresolvable tour partners. Spec leaves this as a presentation detail.
- **Risk:** RLS on `tour_link_member` and `tour_link_group` must allow reading sibling members even when the viewer doesn't own them (to render pill names). → **Mitigation:** the policy must check "user owns AT LEAST ONE tour in the group," not "user owns this specific tour." Tested explicitly.
- **Risk:** Trigger that responds to friendship deletion needs to handle both the explicit `DELETE` and the implicit status flip from `accepted` to `removed`/`blocked`. → **Mitigation:** trigger on both `AFTER DELETE` and `AFTER UPDATE` of friendships, checking the previous-row state.
- **Risk:** Collision scan in the Worker must compute great-circle distance from `goal` GeoJSON. → **Mitigation:** Worker already calls Supabase REST; reuse PostGIS `ST_DWithin` in a `select` against `tours` with the saved tour as anchor (server-side PostGIS already powers the existing tour distance utility — verify reuse vs. add a SQL function).

## Migration Plan

1. **Migration** `<timestamp>_tour_links.sql` adds the three tables, RLS policies, the trigger functions (`fn_evict_on_tour_change`, `fn_evict_on_friendship_break`, `fn_dissolve_when_below_two`), and the triggers wiring them to `tours` and `friendships`. Applied locally via `supabase db reset` first, verified, only then pushed to prod via `supabase db push` (prompted, never auto-run).
2. **Worker** updated together with the migration: `handleTourInterest` rewritten as a collision scanner; new `handleFriendshipBackfill`; new lifecycle endpoints for link requests. Worker deploy is independent of frontend deploy (existing pattern via `wrangler deploy`).
3. **Frontend** PR deletes `duplicate-tour-dialog.vue` and the pending-duplicate branch; adds `features/tour-links/` module; integrates pills/notice/banner into the tour info sheet; adds the backfill collisions page; relabels the `tour_interest` preference row.
4. **Rollback:** Migration is additive (new tables, new triggers) and does not alter existing tour or friendship rows. Rollback = `DROP` the new triggers and tables (forward-fix migration if needed); the legacy `duplicate-tour-dialog` removal can be reverted by restoring the file and the `pendingDuplicate` branch. Worker rollback = redeploy previous Worker version.
5. **Verification:** Vitest unit/integration coverage for collision predicate edge cases, link-request state machine, and trigger eviction/dissolution scenarios run via `npm run test`. Manual smoke per the `/verify` skill: create colliding tours across two test accounts, exercise the handshake, simulate friendship deletion.
