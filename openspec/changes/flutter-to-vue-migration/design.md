## Context

TouringBuddy is a tour-planning app for outdoor enthusiasts. The existing Flutter frontend is being replaced with a Vue 3 + TypeScript web application. The backend (Supabase with PostgreSQL, PostgREST, and Auth) remains unchanged — the Vue app consumes the same API surface.

The Vue project has comprehensive architectural documentation (CLAUDE.md, .claude/ARCHITECTURE.md) but zero source code. This design covers how to translate every Flutter feature to its Vue equivalent while following the prescribed architecture.

**Current Flutter architecture**: Feature-based with Clean Architecture layers (domain/data/presentation), Provider for state management, MaterialPageRoute for navigation, showModalBottomSheet for dialogs.

**Target Vue architecture**: Feature-based with the same layered approach, Pinia composition stores instead of Provider, Vue Router with typed routes, dialogs/sheets as imperative components within pages.

## Goals / Non-Goals

**Goals:**

- Full feature parity with the Flutter app (auth, tours, contacts, user profile, map)
- Follow the project's prescribed architecture from CLAUDE.md exactly
- Clean separation: domain entities (pure TS) → data layer (Supabase + Zod) → presentation (Pinia stores + Vue components)
- Working PWA with Swisstopo tile caching for offline map access
- Type-safe throughout: Zod schemas infer TypeScript types, typed routes, typed stores

**Non-Goals:**

- Native mobile builds (web-first, PWA only)
- Offline data sync with IndexedDB (deferred to a future change — this change covers online-only operation)
- CI/CD pipeline setup (separate concern)
- E2E tests with Playwright (separate concern — unit/component tests are in scope)
- Migration of user data (backend unchanged, no migration needed)

## Decisions

### 1. Flutter Provider → Pinia Composition Stores

**Decision**: Each Flutter `ChangeNotifier` service maps to a Pinia `defineStore` with setup syntax.

| Flutter                                         | Vue                                                    |
| ----------------------------------------------- | ------------------------------------------------------ |
| `UserService extends ChangeNotifier`            | `useUserStore = defineStore('user', () => { ... })`    |
| `ToursService (ChangeNotifierProxyProvider)`    | `useToursStore` calling `useUserStore()` internally    |
| `ContactsService (ChangeNotifierProxyProvider)` | `useContactsStore` calling `useUserStore()` internally |
| `MapViewModel (ChangeNotifier)`                 | `useMapStore = defineStore('map', () => { ... })`      |
| `context.watch<T>()`                            | `storeToRefs(useXStore())` in components               |
| `context.read<T>()`                             | `useXStore()` direct call                              |

**Rationale**: Pinia composition stores with `ref()`, `computed()`, and plain functions mirror Flutter's ChangeNotifier pattern naturally. Proxy providers become simple store-to-store dependencies.

### 2. Flutter Navigation → Vue Router + Imperative Dialogs

**Decision**: Full-page routes use Vue Router; modal sheets are imperative components controlled by store/component state.

| Flutter                                                | Vue                                                       |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `AuthGate` (StreamBuilder on auth state)               | `beforeEach` navigation guard reactive to auth store      |
| `MaterialPageRoute` to `HomePage/EmailEntry/OtpVerify` | Vue Router routes: `/`, `/auth/email`, `/auth/verify-otp` |
| `MaterialPageRoute` to `MapPage`                       | Vue Router route: `/map`                                  |
| `showModalBottomSheet(TourCreationSheet)`              | `v-if` controlled dialog/sheet component within `MapPage` |

**Rationale**: Vue Router handles page-level navigation with auth guards. Flutter's modal bottom sheets don't map to routes — they become locally-controlled overlay components, matching CLAUDE.md's directive that "Modal sheets and dialogs presented imperatively from within page components, not as routes."

### 3. Domain Models: Dart Classes → Zod Schemas + Inferred Types

**Decision**: Each Dart model class becomes a Zod schema in `data/models/` with the TypeScript type inferred via `z.infer`. Domain entities in `domain/entities/` are pure TypeScript interfaces.

```
Flutter: Tour class with fromJson/toJson
Vue:    tourSchema (Zod) in data/models/ → Tour type in domain/entities/
```

**Rationale**: Zod provides runtime validation of Supabase responses (which the Flutter app lacked) while inferring static types. Domain entities remain pure TypeScript per CLAUDE.md.

### 4. Supabase Integration: Direct Client in Services

**Decision**: Create a shared Supabase client composable (`useSupabase`) that returns the initialized client. Repository classes use this directly.

**Rationale**: CLAUDE.md explicitly says "use `@supabase/supabase-js` directly in composables/services, do NOT wrap with Axios." The Flutter app's repository pattern translates directly — each repository becomes a class with methods that call Supabase.

### 5. Map: flutter_maplibre_gl → maplibre-gl JS

**Decision**: Use `maplibre-gl` npm package directly with a Vue composable (`useMap`) managing the MapLibre `Map` instance lifecycle.

| Flutter                 | Vue                                                                |
| ----------------------- | ------------------------------------------------------------------ |
| `MapLibreMap` widget    | `<div ref="mapContainer">` + `new maplibregl.Map()` in `onMounted` |
| `MapLibreMapController` | `Map` instance stored in composable/store                          |
| `onStyleLoadedCallback` | `map.on('load', ...)` event                                        |
| Circle layers for tours | `map.addSource()` + `map.addLayer()` with circle type              |
| `map.animateCamera()`   | `map.flyTo()`                                                      |

**Rationale**: MapLibre GL JS is the web-native equivalent. A composable manages the map lifecycle (create on mount, destroy on unmount) and exposes methods for adding layers, flying to locations, etc.

### 6. Swisstopo Styles: Asset Loading

**Decision**: The base Swisstopo vector tile URL is a constant. The full-color WMTS style JSON is loaded from `public/swisstopo_wmts_style.json` (copied from Flutter's assets).

**Rationale**: Same approach as Flutter — one inline style URL, one loaded from a local JSON asset.

### 7. Component Architecture: Bottom Sheets → Dialog/Overlay Components

**Decision**: Flutter's `showModalBottomSheet` becomes Vue components controlled by reactive boolean state. On mobile viewports, these render as bottom sheets (CSS); on desktop, as side panels or centered dialogs.

**Rationale**: Web apps don't have native bottom sheets. CSS-driven responsive layout is more appropriate than trying to replicate Flutter's exact sheet behavior.

### 8. File-Based Typed Routes

**Decision**: Use `unplugin-vue-router` for file-based routing with auto-generated types. Pages live in `src/features/*/presentation/pages/` but route definitions are centralized in `src/app/router/`.

**Rationale**: CLAUDE.md prescribes `unplugin-vue-router` for typed routes. Centralized route definitions with explicit imports from feature pages keeps routing transparent.

## Risks / Trade-offs

- **[Risk] MapLibre GL JS bundle size (~200KB gzipped)** → Acceptable for a map-centric app. Use dynamic import to code-split the map page.
- **[Risk] Swisstopo tile availability** → Tiles are free and don't require an API key. No SLA, but historically very reliable. Runtime cache with `StaleWhileRevalidate` in service worker mitigates temporary outages.
- **[Risk] No offline data without IndexedDB** → Explicitly a non-goal for this change. Tours/contacts require network. Map tiles cached via service worker provide partial offline map viewing.
- **[Trade-off] No native mobile feel** → PWA on mobile won't match Flutter's native feel. CSS bottom sheets and responsive design provide an acceptable mobile web experience. A native wrapper could be added later.
- **[Trade-off] Auth state race condition on page load** → Supabase `onAuthStateChange` may fire after initial render. The auth guard must handle the loading state gracefully (show spinner, don't flash unauthenticated page).
