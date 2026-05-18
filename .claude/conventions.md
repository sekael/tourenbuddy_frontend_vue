# Code Conventions

## General

- Keep code concise, better solutions use as much as needed, as little as possible code to implement feature 
- `<script setup lang="ts">` for all components
- `defineProps<{ title: string }>()` type-only syntax
- File names: `kebab-case.vue` / `kebab-case.ts`. Types: `PascalCase`
- One component per file, max ~150 lines — extract sub-components
- No `console.log()` — use logger composable
- Handle errors with store state (`loading`, `error`, `data` refs)
- `computed()` for derived state, `watch()` / `watchEffect()` for side effects
- ALWAYS run `npx eslint . --fix` after changes — NEVER use `npm run format`
- NEVER change or format CHANGELOG, this is handled by release-please

## Pinia

- Composition API stores only: `defineStore('name', () => { ... })`
- `ref()` for state, `computed()` for getters, plain functions for actions
- `storeToRefs()` in components for reactive destructuring
- Stores in `features/<name>/presentation/stores/`
- Mock via `createTestingPinia()` in tests

## Routing

- Manual route definitions in `src/app/router/index.ts`
- Auth redirect in `beforeEach` guard, reactive to auth store
- Dialogs/sheets presented imperatively, not as routes

## Styling

- CSS custom properties: slate primary, blue accent
- Design tokens: spacing (xxs–xxl), radius (sm/md/lg), shadows (sm/md/lg)
- Inter font (400/500/600), Material Symbols icons
- Scoped styles by default
- Prefer native CSS (nesting, `:has()`, container queries) over preprocessors

## Supabase / Database

- IMPORTANT: ALL database changes (schema, RLS, functions, triggers, storage policies, buckets, extensions) MUST be applied to the LOCAL Supabase database FIRST — never edit productive DB directly
- Workflow:
  1. `supabase start` (local stack must be running)
  2. Create migration: `supabase migration new <descriptive_name>` → edit generated file under `supabase/migrations/`
  3. Apply locally: `supabase db reset` (re-runs all migrations from clean state) or `supabase migration up`
  4. Verify locally (test feature against local DB), run `npm run test`
  5. Push to prod ONLY after review: `supabase db push` (prompt user — never run unprompted)
- CRITICAL: NEVER edit any existing file under `supabase/migrations/` — migration history is immutable. This includes the baseline `20260101000000_initial_schema.sql`. Every DB change (schema, defaults, RLS, functions, triggers, storage, extensions) MUST go in a NEW migration file created via `supabase migration new <name>`.
- Migration files: `supabase/migrations/<timestamp>_<name>.sql`, fix forward only — never alter history
- NEVER hand-edit prod schema via Supabase Studio/SQL editor — drifts from repo
- `supabase/migrations/_archived/` contains pre-baseline patches — do not run, kept for history only
- Baseline migration `20260101000000_initial_schema.sql` reflects prod schema at cutover; subsequent changes go in new timestamped files
- App must run against local Supabase during development — point `VITE_SUPABASE_URL` to local stack URL (`http://127.0.0.1:54321`) in `.env.local`

## Internationalization

- User-facing text MUST be added as parameterized text supporting `vue-i18n` library
- Check for existing key-value pairs for text in locales JSON files
- Only if none exist, add new key and value for EVERY locale, i.e. `en.json`, `de-CH.json`
- Inject values following pattern `const { t, locale } = useI18n({ useScope: 'global' })` and `t('tours.infoSheet.completedBtn')`
