# Code Conventions

## General

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

## Internationalization

- User-facing text MUST be added as parameterized text supporting `vue-i18n` library
- Check for existing key-value pairs for text in locales JSON files
- Only if none exist, add new key and value for EVERY locale, i.e. `en.json`, `de-CH.json`
- Inject values following pattern `const { t, locale } = useI18n({ useScope: 'global' })` and `t('tours.infoSheet.completedBtn')`
