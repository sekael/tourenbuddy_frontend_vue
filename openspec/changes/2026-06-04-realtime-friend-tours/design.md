## Context

`tours-store` keeps two collections: `tours` (own, live via `postgres_changes` filtered `user_id=eq.<me>`) and `friendTours` (read via `friend_tours_view`, refetched opportunistically). Friend visibility is two-layer (`20260526052115_friend_tour_read_access.sql`): Layer 1 row access (RLS `tours_select_friend`: accepted friendship AND `visibility='friends'`); Layer 2 detail gating (`friend_tours_view` nulls `planned_date`/`gpx_filepath` and reduces partner names unless the viewer is a partner via `tour_partner_user_ids`).

`friendships` rows mean *accepted* (pending lives in `friend_requests`); a friend audience is rows where the owner is `request_user_id` or `response_user_id`, taking the other side. `friendships-store` exposes `friendUserIds` (a `computed<Set<string>>`) kept fresh by its own realtime.

`tour-links-store` already has realtime on `tour_link_request` + `tour_link_member` and a `watch(() => toursStore.friendTours …) → fetchAll()` (line 362). So once `friendTours` is refreshed, tour-links reconciles its group map reactively — the friend-tour mechanism only needs to drive `loadFriendTours()`.

## Why broadcast (not postgres_changes)

A viewer *could* subscribe to `postgres_changes` on `tours` with per-friend `user_id=eq.<friendId>` bindings, RLS-gated. It fails on two counts that broadcast is designed to solve:

1. **Layer-2 detail leak.** `postgres_changes` ships the raw `tours` row; RLS is row-level and cannot null columns, so a non-partner friend would receive exactly the `planned_date`/`gpx_filepath`/partner fields `friend_tours_view` hides. Broadcast is **signal-only** → no columns on the wire → viewer refetches through the gated view.
2. **Visibility-loss undeliverable.** On `friends→private`, RLS suppresses the UPDATE (viewer can no longer SELECT the row), so `postgres_changes` never tells the viewer to drop it. A `SECURITY DEFINER` trigger computes the **OLD-row audience** and pokes the viewer regardless of their now-revoked access.

The requirement is therefore *server-computed, per-viewer, signal-only fanout* — which is exactly broadcast. The only equivalent alternative is a physical `friend_tour_events(viewer_id,…)` table + `postgres_changes`, i.e. the same trigger fanout plus a durable table to GC/TTL. `realtime.send` is the ephemeral form of that, so it wins.

## Goals / Non-Goals

**Goals:**
- Friend tour create/edit/delete/visibility-flip propagates to authorized viewers in realtime, refreshing `friendTours` (Friends tab + friend map markers).
- Newly accepted friendships immediately reveal the new friend's `friends`-visible tours (and tours where the viewer was marked a partner).
- **No leakage:** never deliver existence or detail of a tour the viewer isn't authorized to read.
- Reuse `friend_tours_view`/RPC RLS gating for all data; realtime only signals "refetch."
- No notification dispatch from the realtime handler.

**Non-Goals:**
- Hoisting collision computation to a store (stays a component-scoped `computed` in `collision-notice.vue`).
- Per-event payload patching (full debounced refetch through the view).
- Friend-tour **attachment** realtime (separate surface, fetched on tour open).
- Partner edits that bypass a `tours` write (in-app they go through `update_tour_full` → UPDATE `tours` → covered transitively).
- Replacing the Worker `tour_updates` fanout.

## Decisions

### Decision 1: Broadcast handler drives only `loadFriendTours()`
- **Choice:** `onMessage` (debounced) and `onSubscribed` call `toursStore.loadFriendTours()` and nothing else.
- **Why:** the existing `tour-links` `watch(friendTours) → fetchAll()` (line 362) reconciles the group map whenever the friend-tour id-set changes (create/delete/flip). Collision-notice recomputes from `friendTours` reactively. So driving `loadFriendTours()` updates every downstream consumer for free; reaching into tour-links from the broadcast handler would duplicate an existing reactive edge.
- **Rejected:** broadcast handler also calling tour-links `fetchAll()` (redundant coupling).

### Decision 2: Signal-only payload; refetch through the RLS view
- **Choice:** payload carries no tour fields (at most `{ op, tourId, ownerId }` for debug/coalescing). On receipt, refetch `friend_tours_view`.
- **Why:** the view already enforces Layer 1 + Layer 2 per caller. Payload-in-broadcast would force the trigger to re-implement per-viewer partner gating, duplicating Layer 2 and risking a leak. Signal-only means every datum crosses the wire only through the viewer's own RLS.

### Decision 3: Audience = owner's accepted friends; fire when tour is/was friends-visible
- **Choice:** on `AFTER INSERT OR UPDATE OR DELETE`, if `NEW.visibility='friends'` (INSERT/UPDATE) or `OLD.visibility='friends'` (DELETE / flip), enumerate the owner's accepted friends and `realtime.send` `refetch` to `friend-tours:<friend_id>` each.
- **Why not partner-gate the audience:** partner gating affects *detail*, not row existence — every friend may know a `friends`-visible tour exists; the view gates detail on refetch. So audience is simply "accepted friends," sidestepping `tour_partner_user_ids` in the trigger.
- **Flips:** `friends→private` (OLD friends, NEW not) → OLD audience (drop); `private→friends` → new audience (appear); `private→private` → nothing. **DELETE** → OLD audience if `OLD.visibility='friends'`.
- **Coverage note:** partner add/remove flows through `update_tour_full` (UPDATEs `tours`) → trigger fires → covered.

### Decision 4: New-friendship-accept via a friend-set watch (not the broadcast)
- **Choice:** `tours-store` watches `friendshipsStore.friendUserIds`; on change → `loadFriendTours()`.
- **Why:** accepting a friendship performs no `tours` write, so the broadcast trigger can't fire. The friendships change already arrives via friendships realtime; a reactive watch (mirroring `tour-links watches friendTours`) is the minimal, infra-free hook. Handles unfriend (tours drop) symmetrically. Dependency direction tours→friendships is sound (friend tours depend on friendships).

### Decision 5: Per-viewer private topic + `realtime.messages` RLS
- **Choice:** topic `friend-tours:<viewerUserId>`, subscribed as a **private** channel. `SELECT` policy on `realtime.messages` (scoped to broadcast extension + `friend-tours:` prefix) permits a row only when `auth.uid()::text = split_part(topic, ':', 2)`.
- **Why:** broadcast bypasses table RLS, so `realtime.messages` authorization is the sole gate preventing a user from listening to another's topic. Even a leak only exposes "a tour changed" (signal-only), but we close it. Client must `realtime.setAuth(token)` before subscribing a private channel — the singleton `TOKEN_REFRESHED` listener already does this; the new primitive reuses it.

### Decision 6: New `use-realtime-broadcast.ts` primitive (sibling, not extension)
- **Choice:** add a sibling primitive mirroring the postgres_changes primitive's module-level registry (one channel per topic, refcounted), page-visibility pause/resume, and `onSubscribed` refetch — but subscribing `.on('broadcast', { event }, …)` on a private channel.
- **Why a sibling:** the transports differ (binding shape, `private: true`, `broadcast` vs `postgres_changes`); folding both into one primitive grows branchy and risks regressions in tours/contacts/friendships/tour-links, which all depend on the existing one. Reuse the *shape/conventions*, not the code. Generalising later is possible if a third transport appears.
- **Rejected:** calling `supabase.channel(...)` directly from `tours-store` (violates "all subscriptions go through core/realtime").

### Decision 7: Collision computation stays component-scoped; minimal cleanup
- Keep the disclaimer a `computed` in `collision-notice.vue`; the broadcast only keeps `friendTours` fresh.
- **Remove** the `tour-links-store:333` `onChange` `loadFriendTours()` piggyback + its now-false comment (198 supersedes it). **Leave** the `collision-notice.vue` mount/`ownTourId`/`members` refetch watchers — component-scoped, idempotent, harmless; removing them edits an out-of-scope component for marginal gain.

## Risks / Trade-offs

- **[Risk]** Broadcast-from-DB / `realtime.messages` RLS not honored by the local realtime container.
  → **Mitigation:** early spike task verifies `realtime.send` + topic-scoped RLS locally before building on it.
- **[Risk]** Broadcast missed while the tab is hidden (channel paused for battery).
  → **Mitigation:** `onSubscribed` refetches `friendTours` on every (re-)subscribe.
- **[Risk]** `realtime.messages` RLS misconfigured → leak or silence.
  → **Mitigation:** explicit tests (foreign topic delivers nothing; own topic delivers).
- **[Risk]** Trigger fan-out cost for a user with many friends.
  → **Mitigation:** tour writes are infrequent, friend counts small, `realtime.send` is cheap; client debounce coalesces.
- **[Trade-off]** Two refetch triggers feed `loadFriendTours` (broadcast + friend-set watch). Acceptable; both debounced/idempotent.

## Migration Plan

1. **Spike:** `supabase migration new friend_tours_broadcast_spike` (throwaway) or a manual `psql` check — confirm `realtime.send(...)` exists and a `realtime.messages` RLS policy gates a private channel locally.
2. `supabase migration new friend_tours_broadcast_trigger`: trigger function + `AFTER INSERT OR UPDATE OR DELETE` trigger on `public.tours`.
3. `supabase migration new friend_tours_realtime_messages_policy`: `SELECT` policy on `realtime.messages`.
4. `supabase db reset` locally; verify a friends-visible tour insert emits the right `realtime.messages` rows and a private tour emits none.
5. Manual smoke test (two friends; create / collision disclaimer / edit / friends→private / delete / new-friendship-accept / non-friend negative / hidden-tab resume).
6. `supabase db push` to prod only after PR approval.
7. **Rollback:** new forward-only migration dropping the trigger + `realtime.messages` policy. Never edit history.

## Open Questions

_None remaining. Resolved during the grilling pass:_
- Reconcile wiring → broadcast handler drives only `loadFriendTours()` (Decision 1).
- Mechanism necessity → broadcast forced by Layer-2 leak + visibility-loss undeliverability (see "Why broadcast").
- Primitive → new sibling `use-realtime-broadcast.ts` (Decision 6).
- Topic authorization → `auth.uid() = split_part(topic, ':', 2)` on `realtime.messages` (Decision 5).
- Scope → new-friendship-accept in scope via friend-set watch (Decision 4); attachment realtime out of scope.
- Cleanup → remove `tour-links-store:333` piggyback; leave collision-notice as-is (Decision 7).
