# Architecture Overview

Doc cover arch decisions + patterns **not already in CLAUDE.md**. Structure, conventions, styling, testing, data flow → see CLAUDE.md.

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

Deps point inward. Domain layer = ZERO deps on Vue/data/presentation. Data layer deps on domain interfaces. Presentation deps on domain entities via Pinia stores.

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

- Features never import from another feature internals
- Cross-feature comms via shared composables or Pinia store subscriptions
- Core modules (`core/`) provide shared utils, never depend on features

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

- Supabase Auth via email/OTP. No password auth
- `onAuthStateChange` listener init at app bootstrap, updates auth store reactively
- Router guard reads auth store. No direct Supabase calls in guards
- Token refresh auto via `@supabase/supabase-js`

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

- Map instance via `shallowRef`. Stop Vue deep-proxy of WebGL context
- Tour markers = MapLibre source + layer with GeoJSON metadata for click handling
- On unmount: call `map.remove()` to release WebGL context, prevent memory leak
- Resize: `ResizeObserver` (or `@vueuse/core` `useResizeObserver`) on container, call `map.resize()`
- Camera state sync bidirectional between map events and Pinia store

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

- **Precache**: App shell + static assets via Workbox `generateSW` or `injectManifest`
- **Runtime cache**: Swisstopo tiles use `StaleWhileRevalidate` for offline map
- **Data**: IndexedDB store tour/contact data local, sync with Supabase when online
- **Sync**: Queue mutations in IndexedDB when offline. Replay on reconnect via Background Sync API or manual flush
- **Updates**: `registerType: 'prompt'`. User controls when new service worker activates
- **Manifest**: Config in `vite-plugin-pwa` options for installability (app name, icons, theme color, start URL)

## Error Handling

- Stores expose errors via reactive state: `loading: ref(false)`, `error: ref(null)`, `data: ref(null)`
- Components render all three states via `v-if`
- Custom error classes in `core/exceptions/` for domain-specific types
- Presentation layer maps exceptions to user messages via snackbar composable
- No exceptions cross layer boundaries unhandled. Catch in repositories, surface via store state
- Vue global error handler (`app.config.errorHandler`) logs uncaught errors via logger composable

## Key Decisions

| Decision                         | Rationale                                                |
| -------------------------------- | -------------------------------------------------------- |
| Pinia over Vuex                  | Official Vue 3 rec, composition API, TypeScript-first    |
| Vue Router + unplugin-vue-router | File-based typed routes, type-safe nav                   |
| Supabase JS directly (no Axios)  | Auth tokens, retries, realtime native                    |
| Zod for validation/types         | Runtime validation + TS type inference                   |
| IndexedDB for local storage      | Browser-native, offline, structured data, no bundle cost |
| MapLibre GL JS for maps          | Native vector tiles, free Swisstopo WMTS, best web perf  |
| `shallowRef` for map instance    | Stop Vue deep-proxy of WebGL context                     |
| Workbox via vite-plugin-pwa      | Battle-tested SW tooling, Vite integration               |
| @antfu/eslint-config             | Strictest community config, catch real bugs              |
| Vitest over Jest                 | Vite-native, faster, ESM-first                           |

## Data Flow

```
UI (Vue Component)
  → store (Pinia composition store)
    → Repository (abstract interface from domain/)
      → Service (Supabase client / IndexedDB)
        → Supabase (remote) or IndexedDB (local cache)
```

- Repositories single source of truth — stores never call Supabase directly
- Zod schemas (`data/models/`) validate + type API JSON, map to domain entities
- Domain entities (`domain/entities/`) pure TypeScript, no framework deps
