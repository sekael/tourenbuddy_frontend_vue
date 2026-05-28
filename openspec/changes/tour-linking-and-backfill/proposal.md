# Tour linking and friendship backfill

## Why

The current "signal interest on duplicate" flow couples the social signal to ephemeral notification delivery — if the owner muted `tour_interest` or has no notifications, the signal is lost with no DB record. It also forces the duplicate-saver into a binary decision (save vs. signal) that puts the owner in a "respond or look rude" position, which risks friendship friction. And there is no path at all to reconcile collisions that surface after the fact (two users planned the same goal independently and only later become friends). Linking is the more honest primitive: collaboration is a first-class goal of the platform, and a durable, opt-in, N-way link between same-objective tours expresses it directly while preserving each user's ownership and agency.

## What Changes

- **BREAKING (user-facing flow):** Remove the `DuplicateTourDialog` collision-block. Tours always save freely regardless of friend collisions.
- **BREAKING (semantics):** The `tour_interest` notification no longer signals "the saver chose not to save"; it now signals "a friend has just planned the same tour, consider linking." The enum value `'tour_interest'` is retained end-to-end; only labels and copy change.
- **NEW:** N-way `tour_link_group` membership for tours that share a goal, tour type, and mutual friendships among owners.
- **NEW:** `tour_link_request` two-sided handshake (initiator proposes, target accepts/declines/withdraws). Direct client → DB writes via RLS; the Worker is used only for notification dispatch.
- **NEW:** Server-driven invariants enforced by DB triggers — eviction on goal-move >100 m, tour-type change, visibility flip away from `friends`, or friendship deletion between member owners. Group dissolves only when membership drops below 2.
- **NEW:** Friendship-accept triggers a single batched **backfill digest** notification per side listing pre-existing same-goal/same-type collisions for review.
- **NEW:** Tour info-sheet UI for linked-with pills (per N-way sibling), collision notice with "Request to link" action, link-request banner (pending in/out with accept/decline/withdraw), and a confirm dialog before edits that would evict the tour from a group.
- **NEW:** Backfill-collisions list page reached from the digest notification.
- **REMOVED:** `duplicate-tour-dialog.vue` and the `notifyTourInterest`-on-decline branch in `map-page.vue`.

## Capabilities

### New Capabilities
- `tour-linking`: N-way link groups, link-request handshake, eviction/dissolution invariants, and friendship-accept backfill scan + digest.

### Modified Capabilities
- `tour-collision-handling`: Drop the duplicate-save prompt and decline-→-signal-interest requirements. Tighten the collision predicate to also require equal non-null `tour_type` and mutual friendship between owners (single source of truth shared with Worker). Treat `tour_interest` as a collision-detected signal fired by the Worker after save, not as a decline outcome.
- `shared-tour-notifications`: Repurpose `/notify/tour-interest` from a decline-triggered signal into a server-side collision scan run after every tour save. Add `/notify/friendship-backfill` for the post-accept digest. Mute-toggle behavior for `tour_interest` is preserved (label changes only).
- `notifications`: Reword the `tour_interest` preference label and description to reflect collaboration-suggestion semantics. No enum or schema change.

## Impact

- **DB:** New migration `<timestamp>_tour_links.sql` adds `tour_link_group`, `tour_link_member`, `tour_link_request` tables; RLS policies scoped to "owner of a referenced tour"; triggers for eviction (goal/type/visibility/friendship) and post-eviction dissolution when group count < 2.
- **Worker (`services/email-hook`):** `handleTourInterest` rewritten to scan for friend-owned collisions of the saved tour and dispatch `tour_interest` notifications. New `handleFriendshipBackfill` endpoint (and friendship-accept hook) producing a single per-side digest. Existing per-recipient mute/email/push gating reused.
- **Frontend:** New feature module `src/features/tour-links/` (full DDD layout). Tour info-sheet integration in `features/tours/presentation`. Removal of `duplicate-tour-dialog.vue` and pending-duplicate branch in `map-page.vue`. New router entry for the backfill-collisions page. Notification preferences relabeling. New i18n keys in `en.json` and `de-CH.json`.
- **Collision predicate:** Centralized in `features/tours/domain/collision.ts`, reused by client and (re-implemented identically in) Worker.
- **Out of scope (deferred):** Real-time multi-owner editing of a single tour; absorb-style merging; server-side auto-relinking when friendships are restored; mobile-specific UI variants beyond shared components.
