## Why

Tour create / update / delete currently propagate to other devices only on next manual fetch (e.g. app reload, navigation). Users running the app on phone + desktop see stale lists until they pull-to-refresh. Friendships and friend requests already have Supabase Realtime sync; tours — arguably the more frequently edited surface — does not. Issue #189 asks to close that gap with the same pattern.

## What Changes

- Subscribe `tours-store` to Supabase Realtime `postgres_changes` for `public.tours` and `public.tour_attachments`, both filtered by `user_id=eq.${currentUserId}`. Both tables already carry `user_id` natively — no schema denormalisation needed.
- On any change event, debounced full refetch of tours via existing `loadTours()` (mirrors friendships `fetchAll` pattern). No per-event payload patching.
- `tour_partners` is **not** added to the publication: every legitimate partner change is preceded by an UPDATE/INSERT on `public.tours` (via `update_tour_full` / `create_tour_full`) or a DELETE cascade from `public.tours`, so the `tours` subscription captures it transitively. The one exception — contacts cascade-deleting partner rows — is addressed by the contacts realtime follow-up (#193) via the existing `tours-store.$onAction(deleteContact)` reconciliation.
- Add both tables to the `supabase_realtime` publication and set `REPLICA IDENTITY FULL` (so DELETE events carry the deleted row, enabling RLS filtering and `user_id` filter matching on DELETE).
- Reuse existing `useRealtimeSubscription` primitive (`src/core/realtime/use-realtime-subscription.ts`) — no new infra.
- Out of scope (deferred to a follow-up change): realtime for `contacts` and `user_profile`. Issue mentions evaluating those; agreed to ship tours first.

## Capabilities

### New Capabilities

_None._ Reuses the existing realtime primitive.

### Modified Capabilities

- `tours`: tours list MUST stay in sync across the same user's devices via Supabase Realtime. New requirement covering channel key, bindings, debounced refetch, sign-out teardown.
- `tour-attachments`: attachments list MUST react to remote changes for the currently viewed tour (subscription wiring shared with tours-store; per-tour store reloads on relevant event). No schema change needed (`user_id` already present).

## Impact

- **Schema (new migration only — history immutable):**
  - `tours`: `REPLICA IDENTITY FULL` (user_id column already exists).
  - `tour_attachments`: `REPLICA IDENTITY FULL` (user_id column already exists).
  - `alter publication supabase_realtime add table …` for both (guarded with `duplicate_object` handler, same pattern as `20260520101408_realtime_friendships_publication.sql`).
  - No `tour_partners` change.
- **Frontend:**
  - `src/features/tours/presentation/stores/tours-store.ts`: wire `useRealtimeSubscription` (2 bindings on `tours` and `tour_attachments`, channel key `tours-${uid}`, onChange → debounced `loadTours`, clear-on-signout via existing watcher).
  - `src/features/tours/presentation/stores/tour-attachments-store.ts`: wire subscription on `tour_attachments` filtered by `user_id=eq.${uid}`; onChange refetches only the currently loaded tour (client-side dedupe by event `tour_id`).
- **No notification dispatch from `onChange`** — Realtime is UI-sync only (rule documented in primitive header).
- **RLS:** unchanged. Existing `tours_select_own` / `tour_partners_select_own` / `tour_attachments_select_own` policies continue to gate visibility — Realtime respects RLS.
- **Tests:** new unit tests for channel key derivation, binding shape, and reload-on-change. Existing `tours-store` tests unaffected.
- **Backwards compat:** additive. No API changes. Migration is forward-only and idempotent (`if not exists` / `do $$ … duplicate_object` guards).
