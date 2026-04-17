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

## Error Handling

- Stores expose `loading`, `error`, `data` refs
- Custom exceptions in `core/exceptions/`
- Vue global error handler logs via logger composable

## Data Flow

```
Component → Store → Repository Interface → Impl (Supabase) → DB
```

Zod schemas validate API responses, map to domain entities.
