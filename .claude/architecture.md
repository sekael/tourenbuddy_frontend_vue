# Architecture

## Layers

```
Presentation (Pages, Components, Pinia Stores)
    → Domain (Entities, Repository Interfaces)
        → Data (Repository Impls, Zod Schemas, Services)
            → External (Supabase, MapLibre GL JS)
```

Deps point inward. Domain = zero framework deps.

## Module Boundaries

- Features never import another feature's internals
- Cross-feature via shared composables or Pinia store subscriptions
- `core/` shared utils, never depends on features

## Auth

Supabase email/OTP (no passwords). `onAuthStateChange` at bootstrap updates auth store. Router guard reads auth store — no direct Supabase in guards. Token refresh automatic.

## Map

- `shallowRef` for map instance — prevents Vue deep-proxy of WebGL
- Tour markers as MapLibre source + layer with GeoJSON metadata
- `map.remove()` on unmount to release WebGL context
- Bidirectional camera sync between map events and Pinia store

## PWA

- `vite-plugin-pwa` + `registerType: 'prompt'`
- Precache: app shell + static assets
- Runtime cache: Swisstopo tiles (`StaleWhileRevalidate`, 500 entries, 30-day expiry)
- Asset + tile caching only — no offline data sync

## Realtime (Supabase `postgres_changes`)

- UI-sync only — **never** dispatch notifications from `onChange`. Notification dispatch belongs in store actions (the Worker handles fanout).
- All subscriptions go through `core/realtime/use-realtime-subscription.ts`. Do not call `supabase.channel(...)` directly from features.
- Channels are keyed and refcounted at the module level: multiple consumers of the same `key` share one channel.
- Subscriptions live in stores (see `tours-store`, `tour-attachments-store`, `friendships-store`, `user-blocks-store`, `tour-links-store`). Filters MUST be user-scoped (`user_id=eq.<uid>`) — never subscribe to unfiltered tables.
- `onChange` is debounced 150 ms to coalesce burst updates into a single refetch.
- `onSubscribed` fires after every (re-)subscribe — use it to refetch state so the store is consistent even if events were missed.
- Auth refresh: a module-singleton `TOKEN_REFRESHED` listener calls `realtime.setAuth(...)` so long-lived channels keep working across token rotations.

### Energy / battery optimization

Background tabs and hidden PWA windows pause Realtime to avoid sustained WebSocket + fanout work on mobile.

- A module-level `pageVisible` ref tracks `document.visibilityState`.
- When the document becomes hidden, every active subscription tears down its channel (refcount → 0 → `removeChannel`), closing the WS.
- When it becomes visible again, the watch re-runs, the channel is re-created, and `onSubscribed` refetches — closing any gap from missed `postgres_changes` events.
- Status surfaces `'paused'` while hidden (vs. `'idle'` when explicitly disabled).
- Implication for new stores: always provide an `onSubscribed` callback that does a full refetch. Relying solely on `onChange` will silently drop events that occurred while the tab was hidden.

## Error Handling

- Stores expose `loading`, `error`, `data` refs
- Custom exceptions in `core/exceptions/`
- Vue global error handler logs via logger composable

## Data Flow

```
Component → Store → Repository Interface → Impl (Supabase) → DB
```

Zod schemas validate API responses, map to domain entities.
