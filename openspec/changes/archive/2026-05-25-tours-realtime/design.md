## Context

Tour CRUD writes through `tours-store` and `tour-attachments-store`. Today, only the device that performed the write sees the result; other devices stay stale until next manual fetch. The friendships feature already solved this exact problem in May 2026 by introducing a generic Realtime primitive (`src/core/realtime/use-realtime-subscription.ts`) and adding `friend_requests` + `friendships` to the `supabase_realtime` publication. This change reuses that primitive verbatim.

`tours` and `tour_attachments` both carry `user_id` natively, so the filter `user_id=eq.${uid}` works directly. `tour_partners` (composite PK `(tour_id, contact_id)`, no `user_id`) is **excluded from the publication**: every legitimate partner-set change is preceded by an UPDATE on the parent `tours` row inside `update_tour_full` (line 327–344 of the baseline migration), an INSERT inside `create_tour_full`, or a DELETE cascade from `tours`. Subscribing to `tours` captures all of these transitively. The one path that bypasses `tours` — a `contacts` row delete cascading into `tour_partners` — is out of scope here and will be covered by the contacts realtime follow-up (#193), where the existing `tours-store.$onAction(deleteContact)` reconciler already strips deleted partner ids from local tours. This avoids any schema change on the link table. So either:
1. denormalize `user_id` onto the child tables (chosen), or
2. subscribe broadly without a server filter and rely on RLS + client-side dedupe (rejected — chatty, fragile when a user has many devices and even one of them edits something for another tour).

## Goals / Non-Goals

**Goals:**
- Tour create / update / delete propagate to all of the same user's signed-in devices within ~150 ms (one debounce window).
- Zero new infrastructure: reuse `useRealtimeSubscription`, reuse `supabase_realtime` publication.
- Migration is forward-only, idempotent, and respects the "migrations immutable" rule.
- No notification dispatch from Realtime handlers (matches friendships convention).
- Tour attachments view on a different device reflects upload/delete from the editing device.

**Non-Goals:**
- Real-time multi-user collaboration on a single tour (tours are still single-owner).
- Realtime for `contacts` and `user_profile` — deferred to a follow-up issue.
- Per-event payload patching of local state (chose full refetch for simplicity and view-derived field correctness).
- Offline-first / merge-on-reconnect semantics.

## Decisions

### Decision 1: Full debounced refetch over per-event payload patching
- **Choice:** On any `postgres_changes` event for `tours` / `tour_partners` / `tour_attachments`, the primitive's debounced callback re-invokes `loadTours()`, which re-reads `tours_view` (the view that joins partners and computes shaped output).
- **Why:** `loadTours` already canonicalises the data through `tours_view`; per-event patching would have to reimplement that shaping per event type. A burst of related events (`tour` UPDATE + `tour_partners` INSERT × N) collapses into a single refetch via the 150 ms debounce, so the cost is similar to the patching path under realistic workloads.
- **Rejected:** payload patching — more code paths, more edge cases (view-derived fields like joined partner ids would be stale), no measurable perf win for a single-owner data set.

### Decision 2: Exclude `tour_partners` from the publication
- **Choice:** Do not subscribe to `tour_partners`. No schema change to it. Rely on the fact that every partner-set change in this app flows through `update_tour_full` / `create_tour_full` / tour DELETE, all of which touch the parent `tours` row first.
- **Why:** `tour_partners` has no `user_id` and a denormalised column would only exist to satisfy Realtime's filter syntax — pure schema-for-infra. The `tours` subscription already captures every legitimate partner change via the parent UPDATE/INSERT/DELETE event.
- **Caveat:** `contacts → tour_partners` ON DELETE CASCADE bypasses `tours`. This change does not handle that cross-device. It will be handled by the contacts realtime follow-up (#193): on contact delete, device B's contacts realtime triggers `contactsStore.deleteContact`, and the existing `tours-store.$onAction(deleteContact)` reconciler updates partner ids locally.
- **Rejected:** denormalised `user_id` on `tour_partners` + trigger + backfill — extra DDL, extra drift risk, no observable benefit over the `tours` subscription.
- **Rejected:** broadcast / no-filter subscription on `tour_partners` — RLS still gates, but per-event RLS evaluation cost across all users for negligible UX benefit.

### Decision 3: Distinct per-store channels
- **Choice:** Two channels per signed-in user:
  - `tours-${uid}` — owned by `tours-store`, single binding on `tours`, `onChange` debounces `loadTours()`.
  - `tour-attachments-${uid}` — owned by `tour-attachments-store`, single binding on `tour_attachments`, `onChange` refetches only the currently loaded tour (skip if none).
- **Why:** The existing primitive's per-key dedupe is refcount-only (`use-realtime-subscription.ts:107-112`): a second subscriber sharing a key bumps refcount but its bindings and `onChange` are never wired to the channel — only the first subscriber wins. So shared-key multi-binding is not safe today.
- **Rejected:** single shared channel with `tours-store` fanning out to attachments via a `$onAction` event — couples the two stores and re-implements pub/sub on top of Pinia for no real saving.
- **Rejected:** extending the primitive to fan out per key — scope creep; can be done in a follow-up if a third consumer arrives.

### Decision 4: No notification dispatch from `onChange`
- **Choice:** Realtime is strictly UI-sync. Tours currently has no push-notification surface, but the rule still applies for future-proofing.
- **Why:** Matches the documented constraint in `use-realtime-subscription.ts` and the friendships spec.

### Decision 5: Cluster recompute is implicit via `tours` ref reassignment
- **Context:** `tourenbuddy-map.vue:95` runs `watch([tours, selectedTourId], … markerLayer.updateTours(...))`. Cluster tree is rebuilt inside `tours-marker-layer.ts` whenever this watcher fires.
- **Invariant:** any code path that changes the visible tour set or any tour's `goal` MUST replace `tours.value` with a new array reference (not mutate in place). All existing actions do this (`loadTours` reassigns; `updateTour`/`setCompleted`/`deleteTour` use `.map`/`.filter`).
- **Realtime impact:** realtime → debounced `loadTours()` → `tours.value = await repository.listToursForUser(userId)` reassigns the ref → watcher fires → `markerLayer.updateTours(...)` runs → cluster tree rebuilds. No additional wiring needed.
- **Guard:** include a verification task that on device A creating, moving (goal change), or deleting a tour, device B's map cluster reflects the change within one debounce window.

### Decision 6: `REPLICA IDENTITY FULL` on both subscribed tables
- **Why:** DELETE events need full row contents so the `user_id=eq.${uid}` filter applies — without `FULL`, only PK columns ship and the filter on `user_id` would drop DELETE events.

## Risks / Trade-offs

- **[Risk]** Cross-device propagation of contact-cascade partner deletions is not handled by this change.
  → **Mitigation:** documented dependency on contacts realtime follow-up (#193). Same-device behaviour is unchanged. Acceptable because cross-device contact deletion is itself out of scope until #193 ships.

- **[Risk]** Burst of attachment uploads (up to 5 per tour) on device A causes 5 separate refetches on device B.
  → **Mitigation:** 150 ms debounce on the primitive collapses them into one refetch.

- **[Risk]** A user with many open tabs / devices amplifies Realtime cost.
  → **Mitigation:** per-key dedupe means one channel per `(uid, tab)` regardless of how many stores subscribe; Supabase free tier limits already informally cap this.

- **[Trade-off]** Full refetch on every event uses more egress than per-event patching. Acceptable given typical tour counts (tens, not thousands) and free-tier latency profile.


## Migration Plan

1. Create new migration via `supabase migration new realtime_tours_publication`.
2. In a single forward-only file:
   - `alter table public.tours replica identity full;`
   - `alter table public.tour_attachments replica identity full;`
   - `do $$ begin alter publication supabase_realtime add table public.tours; exception when duplicate_object then null; end $$;` × 2 tables.
3. `supabase db reset` locally; verify with `psql` that publication contains both tables and `relreplident = 'f'` on each.
4. Manual smoke test: open two browser sessions signed in as the same user; create/edit/delete a tour on one and confirm the other updates without reload.
5. Push to prod via `supabase db push` only after user approval.
6. **Rollback:** revert with a new forward-only migration that drops the two publication entries and resets `replica identity` to DEFAULT on both tables. (Never edit history.)

## Open Questions

_None remaining. Decisions from grilling pass:_
- Scope confirmed: tours + tour_partners + tour_attachments only this PR; contacts + user_profile follow-up.
- Refetch strategy confirmed: full debounced.
- `tour_attachments` filter strategy confirmed: denormalised `user_id` column.
