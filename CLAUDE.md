# Project: TourenBuddy Frontend (Vue)

Vue tour-planning app for outdoor enthusiasts. Users pin tour objectives on Swiss topographic map (Swisstopo), associate contacts as tour partners, select planned dates.

## General Principles

- Use subagents aggressively for delegatable tasks, use Haiku model for non-complex subagent tasks
- Opus 4.6 for planning/thinking/specs, Sonnet 4.6 for code implementation
- **Framework:** Vue 3 (latest stable) with TypeScript and `<script setup>` SFCs
- **Build tool:** Vite (latest stable)
- **Targets:** Web (primary, Cloudflare Pages), PWA via `vite-plugin-pwa`
- **State management:** Pinia composition API stores (`defineStore` setup syntax)
- **Routing:** Vue Router 4 with typed routes (`unplugin-vue-router`) + auth navigation guards
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth via email/OTP) — use `@supabase/supabase-js` directly in composables/services, do NOT wrap with Axios
- **Map:** MapLibre GL JS (`maplibre-gl`) with Swisstopo vector tiles (WMTS)
- **Testing:** Vitest for unit/integration, Vue Test Utils for components, Playwright for E2E
- **Linting:** ESLint with `@antfu/eslint-config` (strictest) + Prettier
- **Logging:** Custom `useLogger` composable wrapping `consola` — no `console.log()` in production
- **Validation:** Zod for runtime validation and type inference

## Git Workflow

- IMPORTANT: Before ANY new feature or task, ALWAYS create branch from latest `main`:
  `git fetch origin && git checkout main && git pull && git checkout -b feat/<issue-number>-<short-description>`
- Branch naming: `feat/<issue-number>-<description>` or `fix/<issue-number>-<description>`, omit issue number if none
- NEVER run `git commit`. ALWAYS prompt user to commit + provide ready-to-copy conventional commit message
- Commit messages MUST follow conventional commits: `type(scope): description`
  - Types: feat, fix, refactor, test, docs, chore, style
- Commits atomic — one logical change per commit
- Never commit to `main`
- Versioning automated by release-please — DO NOT MANUALLY edit version in package.json

## CI/CD Pipeline

- **PR checks** (`analyze-and-test.yml`): lint → type check → `vitest run` → Playwright (if configured)
- **Release** (`release.yml`): release-please auto-versions on merge to `main`
- **Deploy** (`build-web-and-push.yml`): builds Vue app, deploys to Cloudflare Pages
- CI creates dummy `.env` — real env file not committed

## Environment Variables

- All client-exposed variables MUST use `VITE_` prefix (Vite requirement)
- Required variables:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- Validate env vars at app startup using Zod:

  ```ts
  import { z } from 'zod'

  const envSchema = z.object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
  })
  export const env = envSchema.parse(import.meta.env)
  ```

- Never commit `.env` files — use `.env.example` with placeholder values
- Access validated env via `env` object, never `import.meta.env` directly in feature code

## Planning & Thinking

- IMPORTANT: For any new feature or non-trivial change, specification-driven development MUST ALWAYS be applied
- Start with OpenSpec skills:
  - **DEFAULT**: `openspec-propose` — propose change with all artifacts in one step. Use when user wants to describe what to build and get complete proposal with design, specs, tasks.
  - `openspec-explore` — thinking partner for exploring ideas, investigating problems, clarifying requirements. Use when user wants to think through something before/during a change.
- Wait for explicit user approval before implementing with `openspec-apply` skill
- Prompt user to archive completed task with `openspec-archive` skill
- Simple task touching >3 files → still produce brief plan
- **Git workflow tasks MANDATORY in every task list:**
  - FIRST task group MUST be "Git Setup" with branch creation from latest `main` (`feat/<issue-number>-<description>`)
  - LAST task group MUST be "Finalize" with lint/format, prompt user to commit (ready-to-copy message), prompt user to push and create PR

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

- Repositories single source of truth — stores never call Supabase directly
- Zod schemas (`data/models/`) validate + type API JSON, map to domain entities
- Domain entities (`domain/entities/`) pure TypeScript, no framework deps

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

## Testing Requirements

- Min test types per feature: unit tests for domain/data logic, component tests for UI
- Vitest built-in mocking for deps — mock abstract repository interfaces, never concrete implementations
- Test Pinia stores via `createTestingPinia()` for component tests, direct store instantiation for unit tests
- Test file location mirrors source: `src/features/tours/...` → `test/features/tours/...`
- Descriptive test names: `'should return user when credentials are valid'`
- Run `npm run test` after every implementation — all tests must pass

## Important Context

- App uses Supabase free tier — expect higher latency on auth operations
- Swisstopo provides free WMTS vector tiles without API key — MapLibre GL JS handles natively
- Backlog: https://github.com/users/sekael/projects/1
- Project values thoughtful, intentional development — understand code before changing, keep PRs small + reviewable
