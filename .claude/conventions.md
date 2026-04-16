## Code Style & Conventions

- ALWAYS run `npm run lint` after changes — zero warnings allowed (CI blocks PRs)
- ALWAYS run `npm run format` before committing (CI checks formatting)
- Use `<script setup lang="ts">` for all Vue components
- Prefer `defineProps` with type-only syntax: `defineProps<{ title: string }>()`
- Public APIs: JSDoc comment (`/** */`)
- File names: `kebab-case.vue` for components, `kebab-case.ts` for modules. Types/interfaces: `PascalCase`
- One component per file. Keep components under 150 lines; extract sub-components
- No `console.log()` in production — use logger composable
- Handle errors with store state (`loading`, `error`, `data` refs) — never swallow exceptions
- Use `computed()` for derived state, `watch()` / `watchEffect()` for side effects

### Pinia Patterns

- Composition API (`setup`) stores only: `defineStore('name', () => { ... })`
- `ref()` for reactive state, `computed()` for getters, plain functions for actions
- `storeToRefs()` in components to destructure store state reactively
- Stores in `features/<name>/presentation/stores/`
- Mock stores in tests via `createTestingPinia()` from `@pinia/testing`
- Repository deps injected via `provide/inject` or store factory functions

### Routing Patterns

- All routes in `src/app/router/`
- File-based typed routes via `unplugin-vue-router` for type-safe navigation
- Auth redirect logic in Vue Router `beforeEach` guard, reactive to Pinia auth store
- Nested routes with `<RouterView>` for persistent navigation shells
- Modal sheets/dialogs presented imperatively from page components, not as routes

### PWA & Offline

- Configure `vite-plugin-pwa` with `registerType: 'prompt'` — let users control updates
- **Precache**: App shell + static assets via Workbox `generateSW`
- **Runtime cache**: Swisstopo map tiles with `StaleWhileRevalidate` for offline map access
- **Data**: IndexedDB for local tour/contact data; sync with Supabase when online
- **Manifest**: Configured in `vite-plugin-pwa` options — include app name, icons, theme color, start URL
- See `.claude/ARCHITECTURE.md` for detailed offline sync architecture

### Styling & Theming

- **CSS custom properties** for theming with orange seed color palette
- Platform detection (`navigator.userAgent` or `@vueuse/core` `useMediaQuery`) for platform-specific styling
- **Design tokens** as CSS custom properties: spacing (xxs–xxl), radius (sm, md, lg)
- Responsive design with CSS container queries + `@vueuse/core` `useBreakpoints`
- Typography via CSS custom properties — use `var(--font-*)` consistently
- Scoped styles (`<style scoped>`) by default; CSS modules for complex component styling
- Prefer native CSS features (nesting, `:has()`, container queries) over preprocessors
