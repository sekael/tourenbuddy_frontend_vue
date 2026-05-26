## Why

Tours are currently scoped strictly to their owner — friends on the platform cannot see the tours they are planning or have completed together, even though TourenBuddy already models friendships and links tour partners. Issue #85 makes friendships meaningful: friends can browse each other's tours, full detail unlocks for tours they share, and friends are notified when a tour involving them changes. This also establishes the per-tour visibility relation needed for the later public/private feature.

## What Changes

- **BREAKING (data layer):** Tour reads are no longer owner-only. A new `tours.visibility` enum (`private` | `friends`, default `friends`) plus widened RLS lets a friend `SELECT` an owner's tour when a friendship exists **and** the tour is `friends`-visible. `private` tours stay owner-only (invisible even to marked partners).
- **Detail gating:** A friend who is *not* a partner on a tour sees the row but with `partner_ids`, `planned_date`, and `gpx_filepath` nulled out. Gating is derived live in the read view via a `security definer` helper that resolves tour partners → registered users (no materialized table).
- **Owner visibility toggle:** Per-tour `private`/`friends` control in the tour form and tour info sheet (owner only).
- **Friend tour browsing UI:**
  - **Map** shows owned tours + friend tours where the viewer is a partner, marked with a friendship icon in the marker and clustered like owned markers.
  - **List** ("My Tours") defaults to owned tours, with separate **Owned** / **Friends** tabs — no merged list, independent search + filter per tab. Non-partner friend tours appear only in the Friends tab (gated).
- **Tour collision handling:** Tours whose goals fall within a 100m radius are treated as the same objective. When user B creates a tour colliding with a friend's tour on which B is already a marked partner, B is prompted to save a duplicate: **yes** saves B's own tour (with the friend marked as partner); **no** discards it and instead notifies the tour owner that B is interested. On the **map**, when an owned tour and a friend tour collide, the owned tour always takes precedence (the friend marker is suppressed); the friend tour still appears in the Friends list tab.
- **Shared-tour notifications:** When a tour involving a friend partner is created, meaningfully edited, or deleted, that friend is notified. Reuses the existing friend-request client→Worker fire-and-forget pattern: a new `tour_updates` notification type, a single generic Brevo email template, recipients = friend partners on the tour excluding the actor, honoring `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types`.

## Capabilities

### New Capabilities
- `friend-tour-visibility`: per-tour visibility setting, friend SELECT authorization (RLS), non-partner detail gating, and the friend-tour browsing surfaces (map markers + list Friends tab).
- `shared-tour-notifications`: notifying friend partners when a shared tour is created/edited/deleted via the notification Worker.
- `tour-collision-handling`: 100m goal-collision detection, the duplicate-save prompt for partner friends, owned-over-friend map precedence, and the `tour_interest` notification.

### Modified Capabilities
- `notifications`: add the `tour_updates` and `tour_interest` notification types to the preference/mute model and preferences UI.

## Impact

- **Database (migrations):** new `tours.visibility` column + check constraint; new `tours` & `tour_partners` SELECT RLS policies for friends; `security definer` helper to resolve a tour's registered partner user IDs; updated `tours_view` (or new friend-read view/RPC) that gates `partner_ids`, `planned_date`, `gpx_filepath` for non-partner friend viewers.
- **Frontend (`features/tours`):** tour schema + entity gain `visibility`; tours repository gains friend-tour reads; tours store gains a friends-tours collection; tour form + info sheet gain the visibility toggle; tour list sheet gains Owned/Friends tabs; map marker layer gains friend styling.
- **Frontend (`features/tours`) collision:** 100m goal-collision detection (reuse `domain/distance.ts`), duplicate-save prompt dialog, owned-over-friend map dedup in the marker layer.
- **Frontend (`features/notifications`):** `NotificationType` union + mute UI gain `tour_updates` and `tour_interest`; new `notifyTourChanged` and `notifyTourInterest` dispatchers.
- **Worker (`services/email-hook`):** new `/notify/tour-changed` and `/notify/tour-interest` endpoints; new Brevo template env vars (DE/EN) for each.
- **i18n:** new keys (visibility labels, Owned/Friends tabs, notification copy) in `en.json` and `de-CH.json`.
- **Tests:** RLS/gating coverage, store friend-tour logic, notification dispatch edge cases.
