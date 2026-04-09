# Project: TourenBuddy Frontend (Vue)

A Vue tour-planning app for outdoor enthusiasts. Users pin tour objectives on a Swiss topographic map (Swisstopo), associate contacts as tour partners, and select planned dates.

## General Principles

- Use subagents aggressively for tasks that can be delegated
- Switch to Opus 4.6 for planning and thinking tasks, and when creating specifications, use Sonnet 4.6 for code implementation
- **Framework:** Vue 3 (latest stable) with TypeScript and `<script setup>` SFCs
- **Build tool:** Vite (latest stable)
- **Targets:** Web (primary, Cloudflare Pages), support for progressive web applications (PWA) via `vite-plugin-pwa`
- **State management:** Pinia with composition API stores (`defineStore` with `setup` syntax)
- **Routing:** Vue Router 4 with typed routes (`unplugin-vue-router`) and navigation guards for auth
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth via email/OTP) — use `@supabase/supabase-js` directly in composables/services, do NOT wrap with Axios
- **Map:** MapLibre GL JS (`maplibre-gl`) with Swisstopo vector tiles (WMTS)
- **Testing:** Vitest for unit/integration tests, Vue Test Utils for component tests, Playwright for E2E
- **Linting:** ESLint with `@antfu/eslint-config` (strictest recommended config) + Prettier
- **Logging:** Custom `useLogger` composable wrapping `consola` — no `console.log()` in production code
- **Validation:** Zod for runtime validation and type inference

## Git Workflow

- IMPORTANT: Before starting ANY new feature or task, ALWAYS create a new branch from latest `main`:
  `git fetch origin && git checkout main && git pull && git checkout -b feat/<issue-number>-<short-description>`
- Branch naming: `feat/<issue-number>-<description>` or `fix/<issue-number>-<description>`, omit issue number if none is available
- Commit messages MUST FOLLOW conventional commits: `type(scope): description`
  - Types: feat, fix, refactor, test, docs, chore, style
- Commits should be atomic — one logical change per commit
- Never commit directly to `main`
- Versioning is automated by release-please — DO NOT MANUALLY edit version in package.json

## CI/CD Pipeline

- **PR checks** (`analyze-and-test.yml`): lint check → type check → `vitest run` → Playwright (if configured)
- **Release** (`release.yml`): release-please auto-versions on merge to `main`
- **Deploy** (`build-web-and-push.yml`): builds Vue app, deploys to Cloudflare Pages
- CI creates a dummy `.env` — real env file is not committed

## Environment Variables

- All client-exposed variables MUST use the `VITE_` prefix (Vite requirement)
- Required variables:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- Validate environment variables at app startup using Zod:

  ```ts
  import { z } from 'zod'

  const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
  })
  export const env = envSchema.parse(import.meta.env)
  ```

- Never commit `.env` files — use `.env.example` as a template with placeholder values
- Access validated env via the parsed `env` object, never `import.meta.env` directly in feature code

## Planning & Thinking

- IMPORTANT: For any new feature or non-trivial change, specification-driven development MUST ALWAYS be applied
- Start with OpenSpec skills:
  - **DEFAULT**: `openspec-propose` to propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation.
  - `openspec-explore` to enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change.
- Wait for explicit user approval of the plan before implementing with `openspec-apply` skill
- Prompt the user to archive a completed task with the `openspec-archive` skill
- If a task seems simple but touches >3 files, still produce a brief plan

## Project Structure

```
src/
  app/                              # App-level config
    router/                         # Vue Router config, route definitions, auth guards
    theme/                          # CSS custom properties, design tokens, typography
  core/                             # Shared across all features
    constants/                      # App-wide constants
    utils/                          # Utility functions
    exceptions/                     # Custom error classes
    logging/                        # Logger composable, log formatter
    composables/                    # Shared composables (useBreakpoint, useSnackbar, etc.)
    components/                     # Shared reusable components (Crosshair, ErrorSnackbar, etc.)
  features/                         # Feature modules — each self-contained
    feature_name/
      data/
        services/                   # Supabase calls, IndexedDB access
        models/                     # Zod schemas + inferred TypeScript types
        repositories/               # Repository implementations
      domain/
        entities/                   # Business object types (pure TypeScript, no framework deps)
        repositories/               # Abstract repository interfaces (TypeScript interfaces)
      presentation/
        stores/                     # Pinia stores (composition API setup stores)
        pages/                      # Full-page Vue components (routed views)
        components/                 # Feature-specific Vue components
test/                               # Unit & component tests, mirrors src/ structure
e2e/                                # Playwright E2E tests
```

## Key Dependencies

```json
{
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^3.0",
    "vue-router": "^4.5",
    "@supabase/supabase-js": "^2.49",
    "maplibre-gl": "^5.4",
    "zod": "^3.24",
    "consola": "^3.4",
    "vee-validate": "^4.15",
    "@vueuse/core": "^12.8"
  },
  "devDependencies": {
    "vite": "^6.3",
    "typescript": "^5.8",
    "vue-tsc": "^2.2",
    "@antfu/eslint-config": "^4.13",
    "prettier": "^3.5",
    "vitest": "^3.1",
    "@vue/test-utils": "^2.4",
    "playwright": "^1.52",
    "unplugin-vue-router": "^0.12",
    "vite-plugin-pwa": "^1.0",
    "@vitejs/plugin-vue": "^5.2"
  }
}
```

## Data Flow

```
UI (Vue Component)
  → store (Pinia composition store)
    → Repository (abstract interface from domain/)
      → Service (Supabase client / IndexedDB)
        → Supabase (remote) or IndexedDB (local cache)
```

- Repositories are the single source of truth — stores never call Supabase directly
- Zod schemas (in `data/models/`) validate and type API JSON, mapping to domain entities
- Domain entities (in `domain/entities/`) are pure TypeScript, no framework dependencies

## Key Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run all tests
npm run test

# Run a single test file
npx vitest run test/features/tours/domain/tour.test.ts

# Type check
npm run type-check

# Lint code (must pass with zero issues — enforced in CI)
npm run lint

# Format code (enforced in CI)
npm run format
```

## Code Style & Conventions

- ALWAYS run `npm run lint` after changes — zero warnings allowed (CI blocks PRs)
- ALWAYS run `npm run format` before committing (CI checks formatting)
- Use `<script setup lang="ts">` for all Vue components
- Prefer `defineProps` with type-only syntax: `defineProps<{ title: string }>()`
- Public APIs should have a JSDoc comment (`/** */`)
- File names: `kebab-case.vue` for components, `kebab-case.ts` for modules. Types/interfaces: `PascalCase`
- One component per file. Keep components under 150 lines; extract sub-components
- No `console.log()` in production code — use the logger composable
- Handle errors with store state (`loading`, `error`, `data` refs) — never swallow exceptions
- Use `computed()` for derived state, `watch()` / `watchEffect()` for side effects

### Pinia Patterns

- Use composition API (`setup`) stores for all stores: `defineStore('name', () => { ... })`
- Use `ref()` for reactive state, `computed()` for getters, plain functions for actions
- Use `storeToRefs()` in components to destructure store state reactively
- Stores live in `features/<name>/presentation/stores/`
- Mock stores in tests using `createTestingPinia()` from `@pinia/testing`
- Repository dependencies injected via `provide/inject` or store factory functions

### Routing Patterns

- All routes defined in `src/app/router/`
- Use file-based typed routes via `unplugin-vue-router` for type-safe navigation
- Auth redirect logic in Vue Router's `beforeEach` guard, reactive to Pinia auth store
- Use nested routes with `<RouterView>` for persistent navigation shells
- Modal sheets and dialogs presented imperatively from within page components, not as routes

### PWA & Offline

- Configure `vite-plugin-pwa` with `registerType: 'prompt'` to let users control updates
- **Precache**: App shell and static assets via Workbox `generateSW`
- **Runtime cache**: Swisstopo map tiles with `StaleWhileRevalidate` strategy for offline map access
- **Data**: IndexedDB for local tour/contact data; sync with Supabase when online
- **Manifest**: Configured in `vite-plugin-pwa` options — include app name, icons, theme color, start URL
- See `.claude/ARCHITECTURE.md` for detailed offline sync architecture

### Styling & Theming

- **CSS custom properties** for theming with an orange seed color palette
- Use platform detection (`navigator.userAgent` or `@vueuse/core` `useMediaQuery`) for platform-specific styling
- **Design tokens** as CSS custom properties: spacing (xxs through xxl), radius (sm, md, lg)
- Responsive design with CSS container queries and `@vueuse/core` `useBreakpoints`
- Typography via CSS custom properties — use `var(--font-*)` consistently
- Scoped styles (`<style scoped>`) by default; use CSS modules for complex component styling
- Prefer native CSS features (nesting, `:has()`, container queries) over preprocessors

## Testing Requirements

- Minimum test types per feature: unit tests for domain/data logic, component tests for UI
- Use Vitest built-in mocking for dependency mocking — mock abstract repository interfaces, never concrete implementations
- Test Pinia stores using `createTestingPinia()` for component tests and direct store instantiation for unit tests
- Test file location mirrors source: `src/features/tours/...` → `test/features/tours/...`
- Name tests descriptively: `'should return user when credentials are valid'`
- Run `npm run test` after every implementation — all tests must pass

## Important Context

- The app uses Supabase free tier — expect higher latency on auth operations
- Swisstopo provides free WMTS vector tiles without API key — MapLibre GL JS handles these natively
- Backlog tracked at: https://github.com/users/sekael/projects/1
- This project values thoughtful, intentional development — understand code before changing it, keep PRs small and reviewable
