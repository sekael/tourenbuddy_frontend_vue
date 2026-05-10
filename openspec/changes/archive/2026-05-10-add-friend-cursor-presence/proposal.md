## Why

Tour planning is inherently collaborative — friends discuss objectives over the same map. Today, two friends looking at the Swisstopo map have no way to point at a feature ("look at this pass") without leaving the app for a phone call or screenshot. Live cursor presence turns the shared map into a low-friction "I'm pointing here" channel and lays the groundwork for richer real-time collaboration (shared selections, co-editing tour drafts) without committing to those scopes yet.

We can ship this without any new server work: Supabase Realtime + Yjs Awareness give us a CRDT-based ephemeral presence channel out of the box, and a freshly-released, maintained Supabase provider (`@supabase-labs/y-supabase` 0.1.0, March 2026) wraps the plumbing.

## What Changes

- **NEW** feature module `src/features/presence/` containing all Yjs / Supabase-Realtime / cursor rendering code. No existing feature module is modified except for a single mount line in the map component.
- Authenticated, phone-verified users join a single shared Supabase Realtime channel `presence:friend-cursors` via a Yjs `SupabaseProvider` with Awareness enabled.
- The local client publishes its map cursor (lon/lat in WGS84) plus identity (user id, display name) to its Awareness state, throttled to ~50 ms.
- Incoming Awareness states are filtered client-side: only states whose claimed `userId` is in `useFriendshipsStore().friendUserIds` are rendered. Self-state is never rendered.
- Each friend is assigned a stable color from a curated 12-color palette via deterministic hashing of their `userId`. Same friend → same color across sessions and across devices.
- Friend cursors render on top of the MapLibre map as a small colored dot with the friend's display name, animated to the latest position. They fade out 5 s after the last update and disappear immediately when a friend disconnects.
- A single new dependency: `@supabase-labs/y-supabase` (which transitively brings in `yjs` and `y-protocols`).
- New i18n keys under `presence.*` for tooltip / accessibility labels.
- No new database tables, RLS policies, or RPCs. No persistence — cursors are session-only.

Explicit non-goals (deferred):

- Touch-device cursor input (pointer/touch presence) — first cut is mouse-only; touch falls back gracefully (no local broadcast).
- Per-tour or per-room scoping. One global channel for now.
- Showing cursors of users you only have as a contact (phone-only, not a verified friendship). MUST require a confirmed friendship to maintain the existing privacy model.
- Showing peer selections, hover state on tours, viewport sharing, or follow-mode.
- Rendering presence on any view other than the main map.

## Capabilities

### New Capabilities

- `friend-cursor-presence`: Real-time, ephemeral display of accepted-friend cursors on the Swisstopo map via Yjs Awareness over Supabase Realtime, gated on phone-verification and confirmed friendship, with stable per-friend colors.

### Modified Capabilities

<!-- None. The map-integration spec is intentionally not modified — the presence layer mounts on top via a sub-component without changing the map component's contract. -->

## Impact

- **New code**: `src/features/presence/**` (data + domain + presentation), one new test directory `test/features/presence/`.
- **Modified code**: `src/features/map/presentation/components/tourenbuddy-map.vue` gains exactly one `<friend-cursors-layer :map="map" />` line in its template + an `<script setup>` import. No store, repository, or layer code in `features/map` is touched.
- **Locales**: new `presence.*` keys in `en.json` and `de-CH.json`.
- **Dependencies**: add `@supabase-labs/y-supabase` (~30 KB unpacked, depends on `yjs`, `y-protocols`, `@supabase/supabase-js` which is already present).
- **No database changes.** No RLS or RPC changes. The existing `friendships` and `auth.users` rows are read-only inputs to client-side filtering.
- **Privacy**: any client that subscribes to the channel can broadcast and observe raw broadcasts. We mitigate by client-side filtering (only friends rendered) and by documenting that the local cursor is published to all channel subscribers — a future iteration can add a Supabase Realtime authorization policy to restrict the channel to verified users. See `design.md` for the full threat model.
- **Performance**: throttled at 50 ms, peer count expected to be O(friend count online), MapLibre rendering uses a single GeoJSON source with one layer. No measurable impact on the existing map.
- **Backlog**: opens follow-ups for touch presence, per-tour rooms, and Realtime channel authorization.
