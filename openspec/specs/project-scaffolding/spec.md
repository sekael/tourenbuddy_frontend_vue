## Purpose

Baseline Vue 3 + TypeScript + Vite project structure, build pipeline, linting, and testing setup.

## Requirements

### Requirement: Project initializes with Vite and TypeScript

The project SHALL have a working `package.json` with all dependencies from CLAUDE.md, a `vite.config.ts` with Vue and PWA plugins, `tsconfig.json` for strict TypeScript, and ESLint/Prettier configuration using `@antfu/eslint-config`.

#### Scenario: Fresh install and dev server start

- **WHEN** a developer runs `npm install && npm run dev`
- **THEN** the Vite dev server starts without errors and serves the app at localhost

#### Scenario: Lint passes on clean project

- **WHEN** a developer runs `npm run lint`
- **THEN** ESLint reports zero warnings and zero errors

#### Scenario: Type check passes

- **WHEN** a developer runs `npm run type-check`
- **THEN** `vue-tsc` completes with no type errors

### Requirement: Directory structure follows CLAUDE.md convention

The `src/` directory SHALL be organized as: `app/` (router, theme), `core/` (constants, utils, exceptions, logging, composables, components), and `features/` (feature modules with domain/data/presentation layers).

#### Scenario: Feature module structure

- **WHEN** a new feature module is created
- **THEN** it SHALL contain `data/` (services, models, repositories), `domain/` (entities, repository interfaces), and `presentation/` (stores, pages, components) subdirectories

### Requirement: Environment variables validated at startup

The app SHALL validate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using a Zod schema at startup. The validated `env` object SHALL be the only way to access environment variables in feature code.

#### Scenario: Missing environment variable

- **WHEN** the app starts without `VITE_SUPABASE_URL` set
- **THEN** the Zod validation SHALL throw an error before the app mounts

#### Scenario: Valid environment

- **WHEN** both `VITE_SUPABASE_URL` (valid URL) and `VITE_SUPABASE_ANON_KEY` (non-empty string) are set
- **THEN** the `env` object SHALL be available with typed properties

### Requirement: Supabase client initialized as singleton

A shared Supabase client SHALL be created using `createClient()` from `@supabase/supabase-js` with the validated environment variables. This client SHALL be reused across all services.

#### Scenario: Client creation

- **WHEN** the app initializes
- **THEN** a single Supabase client instance SHALL be created and exported for use by all repositories

### Requirement: Logger composable wraps consola

A `useLogger` composable SHALL wrap `consola` to provide structured logging. No `console.log()` SHALL appear in production code.

#### Scenario: Logging in a composable

- **WHEN** a composable needs to log a message
- **THEN** it SHALL use `useLogger()` which provides `debug()`, `info()`, `warn()`, and `error()` methods

### Requirement: Design tokens defined as CSS custom properties

Theme tokens SHALL be defined as CSS custom properties: spacing scale (xxs=4px through xxl=32px), border radius (sm=8px, md=16px, lg=24px), and an orange-based color palette.

#### Scenario: Component uses spacing token

- **WHEN** a component needs 16px of padding
- **THEN** it SHALL use `var(--spacing-md)` instead of a hardcoded value
