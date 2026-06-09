## Why

Own tours live-sync via the `tours` `postgres_changes` channel filtered `user_id=eq.<me>` (#189). Friends' tours do **not**: that filter is owner-scoped, and friend visibility (accepted friendship + `visibility='friends'` + per-viewer partner detail gating) is a relationship a single-column `postgres_changes` row filter cannot express. So when friend A creates/edits/deletes a `friends`-visible tour, viewer B's `friendTours` (the Friends tab + friend map markers) stays stale until a manual refetch.

`postgres_changes` cannot be retrofitted to do this, for two independent reasons:
- **Detail leak:** `postgres_changes` ships the *raw* `tours` row. Friend visibility is two-layer — Layer 1 row access (RLS) and Layer 2 *column gating* (`friend_tours_view` nulls `planned_date` / `gpx_filepath` / partner ids for non-partner friends). RLS is row-level and cannot null columns, so a friend subscribing to raw `tours` would receive exactly the fields Layer 2 hides.
- **Visibility-loss is undeliverable:** when A flips a tour `friends→private`, the UPDATE that should tell B "drop this" is suppressed by RLS (B can no longer SELECT the row), so B stays stale forever — the documented `collision-notice.vue` gap.

**Motivating bug (#198):** A and B add the same tour (same goal + activity). B gets push + email (Worker fanout) but the "request to link" disclaimer never appears in realtime. At that moment no `tour_link_*` row exists yet, so tour-links realtime never fires, and `friendTours` has no push signal — B is stale until a manual refetch.

## What Changes

- **Server-side broadcast delivery.** An `AFTER INSERT OR UPDATE OR DELETE` trigger on `public.tours` computes the owner's **accepted-friend audience** and `realtime.send`s a **signal-only** `refetch` poke to each friend's private topic `friend-tours:<friendUserId>`. It fires whenever `NEW.visibility='friends' OR OLD.visibility='friends'` (covers create, edit, `private→friends`, `friends→private`, delete). Private→private writes broadcast nothing.
- **Signal-only payload** (`{ op, tourId, ownerId }` — no tour fields). Each client refetches through the RLS-gated `friend_tours_view`, so Layer-1 and Layer-2 gating apply to every datum — no detail leak, no existence leak. A poke to a (racing) unauthorized recipient just yields an empty refetch.
- **OLD-audience for loss events.** Running `SECURITY DEFINER`, the trigger uses the OLD row's audience for DELETE and `friends→private`, so viewers who could previously see the tour are told to drop it even though RLS would now suppress a `postgres_changes` event.
- **Per-viewer private topic authorization.** A `SELECT` policy on `realtime.messages` permits a session to receive on `friend-tours:<uid>` only when `auth.uid()::text = split_part(topic, ':', 2)` (scoped to the broadcast extension + `friend-tours:` prefix). No user can listen to another's topic.
- **New client primitive** `use-realtime-broadcast.ts` (sibling to `use-realtime-subscription.ts`) — mirrors its per-key registry/refcount, page-visibility battery-pause, and singleton `TOKEN_REFRESHED` → `setAuth`, but subscribes a **private** channel with `.on('broadcast', { event: 'refetch' }, …)`. A new transport, not an extension of the postgres_changes primitive (isolation protects the shared, battle-tested primitive).
- **`tours-store` wiring.** Subscribe `use-realtime-broadcast` on `friend-tours:${uid}`; `onMessage` (debounced) and `onSubscribed` both call **only** `loadFriendTours()`. Downstream consumers (map markers, Friends tab, collision-notice's `friendTours` input, and the existing `tour-links` `friendTours`-watch) update reactively for free — the handler does **not** reach into tour-links.
- **New-friendship-accept refetch.** A `tours-store` watch on `friendshipsStore.friendUserIds` (a `computed<Set<string>>` kept fresh by friendships realtime) calls `loadFriendTours()` when the friend set changes — so a newly accepted friend's `friends`-visible tours (and tours where you were marked a partner) appear immediately, and an unfriended user's tours drop. Independent of the broadcast; rides existing friendships realtime.
- **Remove one redundancy:** delete the `tour-links-store` `onChange` `loadFriendTours()` piggyback (`tour-links-store.ts:333`) and its now-false comment ("`friend_tours_view` has no realtime binding") — 198 makes it the wrong place for that push.

## Capabilities

### New Capabilities

- A friend-tour realtime delivery mechanism: `tours` trigger → per-viewer private broadcast topic → signal-only `loadFriendTours()` refetch. (Recorded under `friend-tour-visibility`.)

### Modified Capabilities

- `friend-tour-visibility`: friends' tours MUST live-update on the Friends tab and friend map markers when a shared tour is created/edited/deleted or its visibility flips, and when a new friendship is accepted — without leaking unauthorized rows or detail. New requirements covering the broadcast mechanism, audience derivation, signal-only payload, topic authorization, the broadcast client primitive, and the friend-set refetch.

## Impact

- **Schema (new migrations only — history immutable):**
  - Trigger function (`security definer`, `set search_path = ''`) on `public.tours` `AFTER INSERT OR UPDATE OR DELETE`: enumerate the owner's accepted friends from `public.friendships` (both directions), `realtime.send('refetch', payload, 'friend-tours:'||friend_id, true)` per friend when `NEW.visibility='friends' OR OLD.visibility='friends'`; OLD-row audience for DELETE / friends→private.
  - `SELECT` policy on `realtime.messages` authorizing `friend-tours:<uid>` to `auth.uid()`.
  - No publication change for delivery — broadcast-from-DB does not depend on the `supabase_realtime` publication.
- **Frontend:**
  - `src/core/realtime/use-realtime-broadcast.ts` (new primitive).
  - `tours-store`: wire `use-realtime-broadcast` on `friend-tours:${uid}` → debounced `loadFriendTours()`; add `watch(friendshipsStore.friendUserIds)` → `loadFriendTours()`.
  - `tour-links-store`: remove the `onChange` `loadFriendTours()` piggyback + comment.
- **No notification dispatch from the broadcast handler** — UI-sync only; `tour_updates` push/email fanout stays in the Worker.
- **RLS:** `tours` / `friend_tours_view` unchanged. New policy only on `realtime.messages`. Signal-only payload means broadcast routing never substitutes for RLS — every datum is re-fetched under the viewer's own policies.
- **Tests:** broadcast primitive (topic key, refcount, visibility pause, `onMessage` debounce, `onSubscribed`); `tours-store` (topic = `friend-tours:${uid}`, message → `loadFriendTours`, `friendUserIds` change → `loadFriendTours`); trigger audience (friends-visible → friends notified; private → nobody; friends→private → OLD audience; non-friend never); `realtime.messages` policy (foreign topic delivers nothing; own topic delivers).
- **Out of scope (non-goals):** friend-tour **attachment** realtime (separate surface, fetched on tour open); partner-resolution changes that bypass a `tours` write (in-app partner edits go through `update_tour_full`, which UPDATEs `tours` → covered transitively).
- **Dependency:** local Supabase realtime container must support Broadcast-from-Database (`realtime.send`) + Broadcast Authorization (`realtime.messages` RLS). CLI 2.104 / supabase-js ^2.49 are new enough; an early spike task verifies it before building on it.
- **Backwards compat:** additive. Own-tour realtime unchanged.
