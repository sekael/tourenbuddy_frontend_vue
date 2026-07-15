## Why

Availability today is private and single-purpose: a user marks their own free
days and only they can see them (#242). The feature's whole point — helping
friends find each other for a shared outdoor day on a given date — is unrealized
until a user can see which friends are also free. #244 closes that loop: friends'
availability becomes readable, live, and shown on the Planned calendar alongside
your own.

## What Changes

- Friends' future availability becomes **readable**: an additive friend-`SELECT`
  RLS policy on `user_availability` lets any accepted friend read another
  friend's rows. No per-user privacy gate — availability is inherently a
  find-each-other signal (private planning belongs in other tools).
- Friends' availability becomes **live**: a statement-level broadcast trigger on
  `user_availability` pings each of the writer's friends (`availability:<friend_id>`
  private topic) to refetch. Own availability also gains realtime
  (`postgres_changes`) for multi-device sync — the store has none today.
- The Planned calendar **shows friends' availability**: every future day a friend
  is available renders that friend as a contact chip, **independent of the
  viewer's own availability** (your free days depend on knowing theirs, so all
  friend-available days are surfaced). Own available days keep their green overlay.
- **Overflow handling**: at most two chips per day (alphabetical by contact name);
  a third-or-more collapses into an **"and more"** chip that opens a per-day list
  of every available friend.
- **Reach out**: tapping a friend chip (or a row in the "and more" list) opens the
  existing `contact-action-menu` (call / WhatsApp) — reused, not rebuilt, because
  every friend is by construction one of the viewer's contacts.

## Capabilities

### New Capabilities
<!-- none — all behavior extends the existing calendar-availability capability -->

### Modified Capabilities
- `calendar-availability`: the owner-only read restriction is relaxed to allow
  friend reads; new requirements are added for friend-availability display on the
  Planned calendar (chips, overflow "and more" list, chip actions) and for
  realtime synchronization of both own and friends' availability.

## Impact

- **DB (new migrations only — history is immutable):**
  - Additive friend-`SELECT` RLS policy on `public.user_availability`.
  - `public.fn_broadcast_availability_change()` + statement-level
    `AFTER INSERT OR DELETE` trigger on `public.user_availability`, mirroring the
    friend-tours broadcast pattern (`realtime.send` per friend, private topic).
  - Realtime `messages` RLS policy authorizing a user to read their own
    `availability:<uid>` topic (mirrors `friend_tours_realtime_messages_policy`).
- **Data layer:** new `AvailabilityRepository.listFriendsFrom(fromDate)` +
  Supabase impl (`user_availability` rows for friends, `user_id <> auth.uid()`),
  new Zod row shape reusing the existing `availabilityRowSchema`.
- **Store:** `availability-store` gains friend-availability state, a `postgres_changes`
  subscription (own) and a `useRealtimeBroadcast` subscription (`availability:<uid>`),
  refetch on friend-set change — mirroring `tours-store`.
- **UI:** `planned-calendar.vue` renders friend chips per day (desktop grid + mobile
  list); new per-day "available friends" list overlay; friend `userId → Contact`
  resolution via inverted `phoneToUserIdMap` (`use-contact-friendship-map`); reuse of
  `contact-action-menu`.
- **Reused unchanged:** `contact-chip-actions` capability (`contact-action-menu`,
  `use-phone-actions`), `friendships` (`friendUserIds`, name/phone RPCs).
- **i18n:** new keys in `en.json` + `de-CH.json` (chip "and more", available-friends
  list title, empty states).
- **No Worker changes.**
