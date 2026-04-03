# Architecture Overview

This document covers architectural decisions and patterns **not already documented in CLAUDE.md**. For project structure, conventions, styling, testing, and data flow, see CLAUDE.md.

## Layered Architecture

```
┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│   Pages, Components, Pinia Stores           │
├─────────────────────────────────────────────┤
│                Domain Layer                  │
│   Entities, Repository Interfaces            │
├─────────────────────────────────────────────┤
│                 Data Layer                   │
│   Repository Impls, Zod Schemas, Services   │
├─────────────────────────────────────────────┤
│              External Services               │
│   Supabase, IndexedDB, MapLibre GL JS       │
└─────────────────────────────────────────────┘
```

## Dependency Rule

Dependencies point inward. The domain layer has ZERO dependencies on Vue, data, or presentation layers. The data layer depends on domain interfaces. The presentation layer depends on domain entities via Pinia stores.

## Module Communication Boundaries

```
┌──────────────────────────────────────────────────────────┐
│                       App Shell                           │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Feature A  │  │  Feature B  │  │  Feature C  │     │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │     │
│  │  │ Store │  │  │  │ Store │  │  │  │ Store │  │     │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         └────────────────┼────────────────┘              │
│                    core/composables                       │
└──────────────────────────────────────────────────────────┘
```

- Features never import directly from another feature's internals
- Cross-feature communication goes through shared composables or Pinia store subscriptions
- Core modules (`core/`) provide shared utilities but never depend on features

## Auth Architecture

```
┌───────────────────────────────────────────────────┐
│                    Vue App                         │
│                                                    │
│  ┌───────────────────────────────────────────┐    │
│  │         Router Guard (beforeEach)          │    │
│  │  Reads auth store → redirects unauthed     │    │
│  └─────────────────┬─────────────────────────┘    │
│                    │                               │
│  ┌─────────────────▼─────────────────────────┐    │
│  │            Auth Pinia Store                │    │
│  │  session: ref()  user: ref()  loading: ref()│   │
│  └─────────────────┬─────────────────────────┘    │
│                    │                               │
│  ┌─────────────────▼─────────────────────────┐    │
│  │        Auth Repository Interface           │    │
│  └─────────────────┬─────────────────────────┘    │
│                    │                               │
│  ┌─────────────────▼─────────────────────────┐    │
│  │         Supabase Auth Service              │    │
│  │  signInWithOtp()  onAuthStateChange()      │    │
│  └────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

- Supabase Auth via email/OTP — no password-based auth
- `onAuthStateChange` listener initializes at app bootstrap, updates auth store reactively
- Router guard reads auth store; no direct Supabase calls in guards
- Token refresh handled automatically by `@supabase/supabase-js`

## Map Architecture

```
┌────────────────────────────────────────────────────┐
│                 Map Component                       │
│  ┌──────────────────────────────────────────────┐  │
│  │  useMap() composable                          │  │
│  │  map: shallowRef<Map>()  ← avoids deep proxy │  │
│  └──────────┬───────────────────────────────────┘  │
│             │                                       │
│  ┌──────────▼───────────────────────────────────┐  │
│  │  MapLibre GL JS instance                      │  │
│  │  • Swisstopo WMTS vector tiles (free)         │  │
│  │  • Tour markers as circle/symbol layers       │  │
│  │  • Click handlers via queryRenderedFeatures()  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Map Pinia Store                              │  │
│  │  camera, selection, pickingMode               │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- Map instance via `shallowRef` — prevents Vue from deep-proxying the WebGL context
- Tour markers rendered as MapLibre source + layer with GeoJSON metadata for click handling
- On component unmount: call `map.remove()` to release the WebGL context and prevent memory leaks
- Resize handling: `ResizeObserver` (or `@vueuse/core` `useResizeObserver`) on the container, calling `map.resize()`
- Camera state synchronized bidirectionally between map events and Pinia store

## PWA & Offline Architecture

```
┌──────────────────────────────────────────────────┐
│                Service Worker                     │
│  (Workbox via vite-plugin-pwa)                    │
│                                                    │
│  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Precache    │  │  Runtime Cache             │ │
│  │  App shell,  │  │  Swisstopo tiles           │ │
│  │  static      │  │  (StaleWhileRevalidate)    │ │
│  │  assets      │  │  API responses             │ │
│  │              │  │  (NetworkFirst)             │ │
│  └──────────────┘  └───────────────────────────┘ │
└──────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────┐    ┌──────────────────────────┐
│  Cache Storage  │    │       IndexedDB           │
│  (tiles, assets)│    │  (tours, contacts,        │
│                 │    │   offline mutation queue)  │
└─────────────────┘    └──────────────────────────┘
```

- **Precache**: App shell and static assets via Workbox `generateSW` or `injectManifest`
- **Runtime cache**: Swisstopo tiles use `StaleWhileRevalidate` for offline map access
- **Data**: IndexedDB stores tour/contact data locally; syncs with Supabase when online
- **Sync**: Queue mutations in IndexedDB when offline; replay on reconnect via Background Sync API or manual flush
- **Updates**: `registerType: 'prompt'` — user controls when the new service worker activates
- **Manifest**: Configured in `vite-plugin-pwa` options for installability (app name, icons, theme color, start URL)

## Error Handling

- Stores expose errors via reactive state: `loading: ref(false)`, `error: ref(null)`, `data: ref(null)`
- Components render all three states using `v-if` conditional rendering
- Custom error classes in `core/exceptions/` for domain-specific error types
- Presentation layer maps exceptions to user-facing messages via snackbar composable
- No exceptions cross layer boundaries unhandled — catch in repositories, surface via store state
- Vue global error handler (`app.config.errorHandler`) logs uncaught errors via the logger composable

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Pinia over Vuex | Official Vue 3 recommendation, composition API, TypeScript-first |
| Vue Router + unplugin-vue-router | File-based typed routes, type-safe navigation |
| Supabase JS directly (no Axios) | Auth tokens, retries, and realtime handled natively |
| Zod for validation/types | Runtime validation + TypeScript type inference |
| IndexedDB for local storage | Browser-native, works offline, structured data, no bundle cost |
| MapLibre GL JS for maps | Native vector tiles, free Swisstopo WMTS, best web perf |
| `shallowRef` for map instance | Prevents Vue from deep-proxying the WebGL context |
| Workbox via vite-plugin-pwa | Battle-tested service worker tooling with Vite integration |
| @antfu/eslint-config | Strictest community config, catches real bugs |
| Vitest over Jest | Vite-native, faster, ESM-first |
