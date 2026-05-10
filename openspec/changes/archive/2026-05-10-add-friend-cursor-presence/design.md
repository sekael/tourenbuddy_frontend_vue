## Context

The TourenBuddy map (`tourenbuddy-map.vue`, MapLibre GL JS over Swisstopo tiles) is currently a single-user surface. Friendships already exist in the codebase as a first-class concept: `useFriendshipsStore().friendUserIds` is a reactive `Set<string>` of user IDs the current user has accepted as friends, and the `friendships` capability already enforces phone-verification on both sides. We want to layer ephemeral, multi-user cursor presence on top of this map without entangling the existing map / tours / friendships modules.

Constraints:

- Vue 3 + TS, `<script setup>` SFCs, Pinia composition stores (per `.claude/conventions.md`).
- Layered DDD: feature folders separate `domain/`, `data/`, `presentation/` (per `.claude/architecture.md`).
- `shallowRef` for the MapLibre instance to avoid Vue deep-proxying WebGL state.
- `@supabase/supabase-js` 2.49 already wired (`@/core/utils/supabase`).
- No console.log — use `useLogger`.
- Locales must be parity-checked across `en.json` and `de-CH.json`.
- ESLint `@antfu/eslint-config` (strict) — zero warnings.
- Free-tier Supabase. Realtime channel concurrency is finite; cursor traffic must be cheap.

Current state: no Yjs, no Realtime usage anywhere in the codebase yet. This is a greenfield addition.

## Goals / Non-Goals

**Goals:**

- Friends can see each other's live cursor on the Swisstopo map within ~100 ms of movement.
- Each friend has a distinct, stable color across sessions.
- Zero impact on users who have no friends online (no DOM, no network traffic beyond a single dormant channel subscription).
- Zero changes to existing feature internals (map, tours, contacts, friendships) beyond a single mount line in `tourenbuddy-map.vue`.
- Code lives entirely under `src/features/presence/**` so it can be deleted or replaced atomically.
- Privacy: cursors are only ever rendered for users who are accepted friends.

**Non-Goals:**

- Touch-screen presence (deferred — initial version is mouse-only).
- Server-side authorization on the channel (deferred — see Risks).
- Co-editing tours, shared selections, follow-mode, viewport sync, voice/chat.
- Persistence of any cursor / presence data.
- Showing presence on contact lists or any non-map view.
- Any UI to opt out of being broadcast (an "incognito" toggle is a reasonable v2; current scope assumes any authenticated, phone-verified user with a friend online opts in).

## Decisions

### Decision 1: Use `@supabase-labs/y-supabase` (not the original `y-supabase`)

The user asked for "y-supabase". Two npm packages exist:

- `y-supabase` 0.0.4-7-alpha — last published Aug 2023, marked early development by author, no recent activity.
- `@supabase-labs/y-supabase` 0.1.0 — published Mar 2026 by Supabase community/labs, full TypeScript types, declared peer-compat with `@supabase/supabase-js@^2.99.0`, ships `SupabaseProvider` and `SupabasePersistence` with first-class `y-protocols/awareness` integration.

We adopt `@supabase-labs/y-supabase`. The local `@supabase/supabase-js` is `^2.49.0`, which satisfies the runtime contract (the `^2.99` peer is a minimum-tested version, not a hard cap). If install fails for peer reasons, we bump our `@supabase/supabase-js` to a `^2.99` line in the same change.

**Alternative considered**: roll our own thin wrapper around `supabase.channel(...).on('broadcast', ...)` and skip Yjs entirely. Rejected — the awareness CRDT (`y-protocols/awareness`) gives us free disconnect cleanup, automatic clientId mapping, and a path to richer collab without re-architecting. Yjs payloads for awareness are tiny.

### Decision 2: Awareness only, no `Y.Doc` content

We use Yjs strictly for its Awareness CRDT. No shared `Y.Map` / `Y.Text`. Cursor state lives only in `awareness.setLocalStateField('cursor', { lon, lat, t })` and `awareness.setLocalStateField('user', { id, name })`. No persistence (`SupabasePersistence` is not enabled).

Rationale: cursor positions are pure presence — never saved, never reconciled. A `Y.Doc` would add bandwidth and a Postgres table for no benefit.

### Decision 3: One global channel `presence:friend-cursors`

All authenticated, phone-verified users subscribe to a single Supabase Realtime channel. Each client filters incoming Awareness states to render only those whose `user.id` is in the local `friendUserIds` set. Self is never rendered.

**Alternatives considered**:

- Per-friendship channel (`presence:fc:<userA>:<userB>`) — would scale the channel count quadratically with the friend graph. Free-tier Realtime has channel-count limits. Rejected.
- Per-tour channel (`presence:tour:<tourId>`) — narrower but loses the "see my friend on the map" use-case when no specific tour is open. Reasonable v2.

Trade-off: the global channel publishes our cursor to all subscribers, not only our friends. See Risks → Privacy below.

### Decision 4: Stable, deterministic per-friend color (palette of 12)

A fixed 12-entry palette (high-contrast against Swisstopo base + classic styles, accessibility-checked) lives in `presence/data/presence-palette.ts`. The color for a given `userId` is `palette[hash(userId) mod 12]` using a tiny FNV-1a hash. Local user's own color is computed the same way and broadcast as part of the Awareness state, so peers all show the same color for the same user even if their palette implementation drifts (the broadcast wins; palette is the fallback when a peer hasn't sent identity yet).

**Alternative considered**: random per-session color — rejected; the user explicitly said "one per contact" implying stability per contact.

The user's request says "random colors". We interpret as "from a curated palette, deterministically assigned per contact", which gives the visual feel of randomness while remaining stable — flagged in proposal so the user can override.

### Decision 5: Cursor source = `pointermove` on the map container, throttled 50 ms

Local cursor capture:

- `pointermove` listener on the MapLibre canvas (added/removed when the layer mounts/unmounts and the user is verified+has friends).
- Convert pixel → lon/lat with `map.unproject({ x, y })`.
- Throttle with `lodash`-style throttle (we have `@vueuse/core`, use `useThrottleFn` with `trailing: true`).
- 50 ms ≈ 20 Hz; comfortable for human eye, well under any sane realtime budget.
- Skip emission when `pointerType !== 'mouse'` to avoid spurious touch noise; the touch UX is a follow-up.

Idle handling: emit one final position then `awareness.setLocalState(null)` after 30 s of no movement to free the slot for peers (peers will see the cursor disappear). A `pointerleave` on the canvas does the same immediately.

### Decision 6: Render with a single MapLibre GeoJSON source + symbol/circle layer

Friend cursors render as a MapLibre `circle` layer (colored dot) with a `symbol` layer (text label = display name) bound to the **same** GeoJSON source `presence-cursors`. The source is updated in-place via `setData()` whenever the reactive friend-cursors map changes.

**Alternatives considered**:

- DOM markers (`new maplibregl.Marker(...)` per cursor) — heavier; per-cursor DOM nodes. With small N (typically <10) it's fine, but the GeoJSON-layer approach scales more gracefully and keeps animation interpolation in WebGL.
- Custom canvas overlay — overkill for a dot + label.

Animation: we apply a CSS-style smooth transition by interpolating between the previous and new lon/lat over ~80 ms in JS (`requestAnimationFrame`), updating the source on each frame. Simpler than MapLibre's `paint` transitions for source data and avoids relying on style transitions which only apply to `paint` properties not source positions.

### Decision 7: Mount via a single sub-component inside `tourenbuddy-map.vue`

Integration line inside the map component template:

```vue
<friend-cursors-layer v-if="map" :map="map" />
```

The component imports from `@/features/presence/presentation/components/friend-cursors-layer.vue`. It owns the entire lifecycle: provider connect/disconnect, source/layer add/remove, pointer listener attach/detach, watcher on friend set. Cleanup on unmount is mandatory because the map style can swap (already happens in `tourenbuddy-map.vue` watch on `currentStyleIndex`); the layer subscribes to `style.load` to re-add itself.

**Alternative considered**: fully decoupled via a global Pinia store and a separate floating Vue component. Rejected — we need direct access to the MapLibre instance to add the source/layer; passing the instance via prop is the cleanest seam and keeps the integration to one line.

### Decision 8: Activation gate

The `<friend-cursors-layer>` short-circuits to a no-op (no provider connect, no listeners, no DOM/layer) unless ALL hold:

1. `useAuthStore().isAuthenticated`
2. `useFriendshipsStore().isPhoneVerified` (caller must be verified)
3. `useFriendshipsStore().friendUserIds.size > 0`

Rationale: no friends online ⇒ no purpose served. Avoids consuming a Realtime slot for users with empty friend graphs.

### Decision 9: Awareness state shape

```ts
type LocalAwarenessState = {
  user: {
    id: string                 // auth.uid() of the local user — used for friend filtering
    name: string               // display name (full_user_profile.display_name fallback to local part of email)
    color: string              // '#rrggbb' from palette
  }
  cursor: {
    lon: number                // WGS84 longitude
    lat: number                // WGS84 latitude
    t: number                  // Date.now() — for staleness checks
  } | null                     // null while pointer is off-canvas
}
```

Validated with a `Zod` schema (`presence/data/models/awareness-schema.ts`) on every incoming state — malformed peers are dropped silently with a debug log. This protects against a future schema migration AND against a hostile peer broadcasting garbage.

### Decision 10: No new database tables, no new RPCs

Friend identity is read from existing structures:

- `useAuthStore().currentUser.id` for self id.
- `useFriendshipsStore().friendUserIds` for filter set.
- `useUserProfileStore().fullProfile.displayName` (or fallback) for self display name.

For peer display names: we trust the `user.name` field in the peer's awareness state. We do NOT cross-reference our local user_profile cache (peers might be friends whose profiles we haven't loaded). This matches the existing privacy model — peers already implicitly know each other (they've accepted each other's friend requests).

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| **Privacy: any channel subscriber can read all broadcast cursors and identities, not only their friends.** | (a) Document explicitly in proposal + this design. (b) Client filtering on render still means non-friends don't see anything in the UI, but a malicious client can intercept broadcasts. (c) Follow-up: enable Supabase Realtime authorization policies to restrict the channel to authenticated users and consider per-friend-pair channels. (d) Cursor data is geographic and ephemeral; the leakage is bounded. |
| **Privacy: a hostile peer can spoof `user.id` in their awareness state and pretend to be someone else.** | Awareness state is unsigned; we cannot prevent spoofing client-side. Spoofed `userId` of a friend would render as that friend's cursor. Realistic impact: prank cursor jitter. We accept this for v1; v2 should use a server-side authorization policy or signed identity. Documented. |
| **Pointer noise on touch devices floods the channel.** | Filter `pointerType === 'mouse'` before emitting. Touch users see friends but don't broadcast. |
| **MapLibre `style.load` after style swap drops our source/layer.** | Subscribe to `style.load` in the layer component and re-add source + layer + re-bind data, mirroring the existing pattern in `tourenbuddy-map.vue`. |
| **Yjs and y-protocols add bundle weight.** | `@supabase-labs/y-supabase` ships ~14 KB, `yjs` minified+gz is ~50 KB. Acceptable for the value. Tree-shake on production build verified by inspecting the Vite bundle output before merge. |
| **`@supabase-labs/y-supabase` declares peer `@supabase/supabase-js@^2.99` while we are on `^2.49`.** | At install time, npm will warn. Bump our `@supabase/supabase-js` to `^2.99` in the same PR. The 2.49 → 2.99 jump is non-breaking for our usage (no breaking changes in the auth/postgrest API we touch — verify via changelog scan in tasks). |
| **Realtime free-tier channel-message rate.** | Throttle 50 ms per client + 30 s idle drop. Worst case: 12 friends × 20 Hz = 240 msg/s on a busy day. Within typical Realtime budgets. If it becomes an issue, drop throttle to 100 ms (10 Hz). |
| **Peer count blow-up if many users share the global channel.** | Worst-case bandwidth scales with N total subscribers, but rendering only scales with N friends. We rely on Awareness's per-clientId state to keep payloads tiny. If the user-base grows past ~10k concurrent we will move to per-friend-pair or per-tour channels. |
| **Color palette accessibility.** | Curate a palette with WCAG 3:1 contrast against both Swisstopo base (light) and classic (mixed) styles; include a 1 px white outline on the dot for guaranteed legibility. |
| **Subscribing to the channel before friendships have loaded yields a flicker of "no peers".** | Activation watcher waits for `friendUserIds` to settle (mirrors existing `friendships-store` auto-fetch on auth). Before activation the layer is a no-op. |

## Migration Plan

This is a purely additive change with no DB / API surface.

1. Install `@supabase-labs/y-supabase`; bump `@supabase/supabase-js` to `^2.99` in the same PR.
2. Land all `src/features/presence/**` code behind the activation gate (Decision 8). The gate guarantees that on first deploy, only users who already have at least one friend will exercise the new code path.
3. The `<friend-cursors-layer>` mount in `tourenbuddy-map.vue` is wrapped in `v-if="map"`; if the import fails or the component throws on mount, MapLibre continues rendering normally (component error boundary via Vue global error handler logs and is non-fatal because the layer adds itself out-of-band).

**Rollback**: revert the PR. No DB migrations to undo. No data to clean up.

## Open Questions

- Should the local user be allowed to see their own cursor as an awareness peer for QA purposes (e.g. debug toggle)? Default: no, but a `?presence=debug` query flag could enable it. Defer.
- Should the cursor label render the friend's actual name or only an initials avatar to reduce on-map visual clutter? Current plan: short display name (truncate to 12 chars) with the colored dot. Open for design feedback during implementation.
- Future: per-tour channel scoping when a tour info sheet is open ("see only friends looking at this tour"). Out of scope for this change.
