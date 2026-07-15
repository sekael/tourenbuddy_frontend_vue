## Context

`user_availability` ships from #242 as owner-only: composite `(user_id, date)`
PK, owner-only RLS, and an atomic `apply_availability_diff(added, removed)` RPC.
The table was deliberately shaped so #244 is **purely additive** — no schema
migration, just new RLS/trigger/policy and read paths.

The repo already solves the near-identical "show a friend's data live" problem
for **tours** (#198): an additive friend-`SELECT` RLS policy on `tours` makes rows
visible, and because `postgres_changes` cannot filter deliveries per-recipient by
friendship, a `SECURITY DEFINER` trigger calls `realtime.send` once per friend to
a private broadcast topic (`friend-tours:<friend_id>`), which the client
subscribes to and treats as a "refetch" ping. `tours-store` consumes it via
`useRealtimeBroadcast`; friend rows are refetched through a security-invoker view.
Availability reuses this shape wholesale.

Contacts, friendships, and reachability are already wired: friendships are only
formed through a contact (DB triggers dissolve a friendship when its backing
contact/phone disappears), so **friend ⟺ contact** is an enforced invariant.
`use-contact-friendship-map` maintains `phoneToUserIdMap`; inverting it yields the
`userId → Contact` resolution a friend chip needs. `contact-action-menu` +
`use-phone-actions` already render call/WhatsApp from a `Contact`.

## Goals / Non-Goals

**Goals:**
- Friends can read each other's future availability (RLS), live (broadcast).
- Planned calendar shows friend chips on every future friend-available day,
  independent of the viewer's own availability, with 2-chip + "and more" overflow.
- Friend chips reach out via the existing contact-action menu — no new menu.
- Own availability also syncs across the viewer's devices.

**Non-Goals:**
- No per-user privacy gate / opt-out for availability (out of scope by design —
  availability is a find-each-other signal).
- No intersection logic (own ∩ friends) — friend days show regardless of own.
- No changes to how own availability is edited/saved (#242 flow stands).
- No Worker / notification-dispatch changes; realtime is UI-sync only.
- No new spec for chip actions — `contact-chip-actions` is reused unchanged.

## Decisions

### D1 — Friend read via additive RLS `SELECT` policy, mirroring `tours_select_friend`
Add `user_availability_select_friend`: `exists(accepted friendship between
auth.uid() and user_availability.user_id)`. ORs with the existing owner-only
select. No view is needed (unlike tours) — availability has no sensitive columns
to gate; `(user_id, date)` is the whole row.
- *Alternative:* a `SECURITY DEFINER` RPC returning the friend-availability set.
  Rejected — RLS is declarative, matches the tours precedent, and needs no
  function to maintain.

### D2 — Realtime: own via `postgres_changes`, friends via broadcast trigger
Own availability: `postgres_changes` on `user_availability` filtered
`user_id=eq.<uid>` → refetch own (multi-device sync; the store has none today).
Friends: `postgres_changes` can't scope delivery to "my friends", so a
`SECURITY DEFINER` **statement-level** `AFTER INSERT OR DELETE` trigger on
`user_availability` reads the changed rows via **transition tables**
(`REFERENCING NEW TABLE / OLD TABLE`), takes their `distinct user_id`, and for
each changed user loops that user's accepted friends, `realtime.send`ing a
`refetch` event to each `availability:<friend_id>` private topic. Client
subscribes via `useRealtimeBroadcast`, exactly like friend-tours.
- *Why statement-level, not per-row (deviation from the friend-tours trigger):* a
  save is a multi-day diff — one RPC writes many rows. A per-row trigger would emit
  N sends × M friends per save. `FOR EACH STATEMENT` emits once per
  insert/delete statement (≤2 per save) regardless of row count.
- *Why transition tables, not `auth.uid()`:* the changed user must come from the
  rows, not the caller. `apply_availability_diff` runs `insert` and `delete` as
  two statements in one txn, so a removal-only save still executes the (0-row)
  insert statement — an `auth.uid()`-driven trigger would fire a spurious
  broadcast there. Guarding on `exists (select 1 from <transition table>)` skips
  the empty statement, and reading `user_id` from the rows keeps the trigger
  correct for any write path (not just the authenticated-session RPC).
- A realtime `messages` RLS policy authorizes each user to read their own
  `availability:<uid>` topic (mirrors `friend_tours_realtime_messages_policy`).

### D3 — Friend fetch: new `listFriendsFrom(fromDate)` repo method
`select user_id, date from user_availability where date >= from and user_id <>
auth.uid()` (own rows excluded; RLS already limits the rest to friends). Reuses
`availabilityRowSchema`. Store keeps friend availability as its own reactive
collection (a `Map<dayKey, userId[]>` or list of rows), separate from `savedDays`.

### D4 — Chip identity & actions: resolve `userId → Contact`, reuse the menu
Chips are keyed and deduped by **`userId`** (one chip per friend per day). The
`contact_methods_value_unique_per_user` index (migration 20260706065541)
guarantees a friend's phone resolves to at most one contact, so no contact
tiebreak is needed; dedup-by-`userId` only guards the reverse case of one contact
card carrying two different friends' phones (→ two friends, two chips).
Availability rows carry `userId`. Invert `phoneToUserIdMap`
(`use-contact-friendship-map`) to get the `Contact`; label + alphabetical sort key
= `resolveContactName(contact)`. Tapping a chip opens `contact-action-menu` with
that `Contact`. Unresolved `userId` (map not yet populated, or the rare
deleted-contact-but-still-friend window) → fall back to the registered profile
name via `friendshipsStore.getNamesByUserIds` (the same resolver friend-tour
partner names use), render the chip name-only, no menu — never blank, never a
broken action.
- *Alternative:* build a lighter menu from phone via `use-phone-actions`. Rejected
  — the full menu already exists and every friend resolves to a contact, so reuse
  is the smaller diff.

### D5 — Rendering & overflow in `planned-calendar.vue`
Derive a `friendsByDay` computed (`dayKey → sorted Contact[]`) from friend
availability rows + the resolver, filtered to future days. Both layouts (desktop
grid, mobile list) render friend chips in their **own section**, separate from and
additive to the existing tour pills, with an **independent** 2-chip + "and more"
cap (a day can show up to 2 tour pills + tour-more *and* 2 friend chips +
friend-more). Friend chips are **neutral**: contact name only, no avatar, no
tour-type coloring — so they read as people, not tours. Up to two chips + an
"and more" chip when >2. "and more"
opens a per-day list overlay (bottom sheet on mobile) of all available friends,
each row itself opening the contact-action menu. Own-availability green overlay is
untouched.

Ownership mirrors the tours flow: `planned-calendar` owns the `ContactActionMenu`
and the per-day "and more" list (passing the tapped chip's `getBoundingClientRect`
as `anchorRect`), and **re-emits** `editContact` upward — exactly as
`tour-info-sheet` does. `calendar-page` catches `editContact` and opens
`ContactsListSheet` with `:initial-contact-id` over the calendar (dialog on
desktop / bottom sheet on mobile via `AdaptiveOverlay`), returning to the calendar
on close — the same `handleEditContact`/`handleContactsClose` host wiring
`map-page` already has. The calendar page has no overlay host today, so this is
net-new (but copied, not invented).

## Risks / Trade-offs

- **Broadcast fanout on large saves** → statement-level trigger caps it at ≤2
  sends per friend per save (D2); the consumer refetch is idempotent.
- **Chip resolution lag** (`phoneToUserIdMap` populates async) → graceful
  name-only degrade (D4); resolution completes and the menu activates on next tick.
- **Stale friend availability when a friendship is removed** → the friend-set watch
  (mirroring `tours-store`) refetches on `friendUserIds` change, dropping the
  ex-friend's rows; RLS also stops returning them.
- **Hidden-tab realtime pause** (architecture: subscriptions tear down when the tab
  is hidden) → both subscriptions MUST refetch in `onSubscribed`, closing any gap
  from events missed while paused.
- **No privacy gate** is a deliberate product decision, not an oversight — revisit
  only if a future issue introduces availability visibility scoping.

## Open Questions

None — the four design decisions (intersection semantics, read/realtime
mechanism, privacy gate, chip reuse) were resolved with the issue author before
this document.
