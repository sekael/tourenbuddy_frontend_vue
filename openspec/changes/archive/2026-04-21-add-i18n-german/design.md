## Context

App currently English-only. Hard-coded literals scattered across SFC `<template>` and `<script>` blocks, Zod error messages, snackbar feedback, and form validation. Primary user base is Swiss German. Per-device persistence required (installed PWA on Android and iOS each distinct from web browser on same account).

Stack constraints: Vue 3 + `<script setup>`, Pinia composition stores, Vite 6, ESLint strict, no `console.log`, no Axios. Locale must NOT round-trip through Supabase.

## Goals / Non-Goals

**Goals:**

- Single source of truth for all user-facing text per locale
- Type-safe message keys (autocomplete + compile-time error on missing keys)
- Reactive locale switching without full reload
- Auto-detect from `navigator.language`, fallback English
- Persist via `localStorage`, survives logout
- Localize: UI strings, validation messages (Zod + libphonenumber wrappers), date/number formatting, `<html lang>`

**Non-Goals:**

- Right-to-left language support
- Server-driven translations / Supabase locale storage
- Pluralization rules for languages beyond en/de (CLDR-complex)
- Locale negotiation across multiple devices for same account
- Translating user-generated content (tour names, contact notes)
- Translating Swisstopo map labels (vendor-controlled)

## Decisions

### Library: `vue-i18n@11`

- **Why**: De facto standard for Vue 3, composition API, TypeScript codegen, lazy-load locales, scoped/global modes, integrates with Vite via `@intlify/unplugin-vue-i18n`.
- **Alternatives**: `@formatjs/intl` (heavier, ICU-focused, less Vue-idiomatic). `fluent-vue` (Mozilla Fluent — overkill for two locales). Hand-rolled (rejected — pluralization + date formatting reinvention).
- **Mode**: Composition API global scope (`useI18n({ useScope: 'global' })`) so translations available everywhere without per-component message blocks.

### Message format: JSON, one file per locale

- **Why**: Editor tooling, simple diffs, vue-i18n native support. Type generation via `@intlify/unplugin-vue-i18n` produces `.d.ts` from messages.
- **Layout**: `src/locales/en.json`, `src/locales/de-CH.json`, namespaced by feature (`auth.signIn.title`, `tours.list.empty`).
- **Alternatives**: YAML (extra parser), per-feature colocated files (harder to keep parity). Decision: single file per locale until catalog grows past ~500 keys.

### Locale codes: `en` and `de-CH`

- **Why**: `de-CH` matches Swiss-German users (no ß, Swiss number/date conventions via `Intl`). `en` left region-less for broad fallback.
- **Detection**: `navigator.languages` first match against supported list; substring match (`de-AT` → `de-CH`); else `en`.

### Persistence: `localStorage` key `tb.locale`

- **Why**: Per-device by definition. Installed-PWA storage is isolated from the browser on both Android (Chrome PWA) and iOS (Add to Home Screen / standalone Safari WebApp), satisfying the per-device requirement on both platforms. Synchronous read at boot — no flash of English.
- **iOS caveat**: Safari evicts site data after ~7 days of non-use; if eviction occurs, locale falls back to detection. Acceptable — same path as a fresh install.
- **Alternative rejected**: IndexedDB (async, would flash). Cookie (sent to Supabase needlessly). Supabase user_profile column (violates per-device requirement).
- **Survival across logout**: `localStorage` is not auth-scoped; auth signOut MUST NOT clear `tb.locale`.

### Boot sequence

1. `main.ts`: read `localStorage['tb.locale']` synchronously
2. If absent, run detection from `navigator.languages`
3. Install vue-i18n with resolved locale BEFORE mounting app
4. `useLocaleStore` Pinia store wraps current locale + setter; setter writes localStorage + updates `i18n.global.locale.value` + sets `document.documentElement.lang`

### Type safety

- `@intlify/unplugin-vue-i18n` with `compositionOnly: true`, `strictMessage: true`, `escapeHtml: true`
- Augment `vue-i18n` module declaration so `t()` infers keys from `en.json` (source of truth)
- CI lint check: missing keys in `de-CH.json` vs `en.json` fail build (custom script)

### Validation messages

- Zod: use `z.setErrorMap()` with map that calls `t('validation.<code>')` — error map installed AFTER i18n init, re-installed on locale change via watcher
- Phone: `usePhoneValidation` composable wraps libphonenumber + emits keys like `phone.invalidCountry` instead of literal strings

### Formatting

- Dates: `Intl.DateTimeFormat(locale)` via `useFormatter` composable; do NOT use vue-i18n `$d` (extra config) unless catalog grows
- Numbers: same pattern with `Intl.NumberFormat`
- Phone formatting (display): unchanged — `libphonenumber-js` is locale-agnostic

### Profile language selector

- Single-select radio group (per issue) in `UserProfilePage`
- Options derived from supported locales registry (`src/core/i18n/supported.ts`)
- Calls `localeStore.setLocale(code)` — instant switch, snackbar confirms in NEW locale

### `<html lang>` sync

- `watchEffect` in app root: `document.documentElement.lang = locale.value`

## Risks / Trade-offs

- **Catalog drift**: en.json and de-CH.json get out of sync → Mitigation: CI parity check script (`scripts/check-locale-parity.ts`) fails on missing keys
- **Bundle bloat**: Both catalogs eager-loaded → Acceptable for two locales (~10 KB each gz). If grows, switch to dynamic import per locale.
- **SSR mismatch**: N/A — Cloudflare Pages serves SPA only
- **Test snapshot churn**: Existing tests with literal strings break → Mitigation: tests assert via `t()` key lookups OR data-testid + behavior, not literal text
- **Swisstopo labels stay German/French/Italian regardless of UI locale** → Document in user-facing help; out of scope
- **Time-to-first-paint penalty from sync localStorage read** → Negligible (<1ms)
- **Migration of ~30 components** → Mechanical but large diff; do feature-by-feature, one PR per major feature area if reviewer prefers (confirm with user)

## Migration Plan

1. Land infrastructure (vue-i18n install, boot wiring, store, type setup) — empty catalogs
2. Migrate `core/components` + `core/composables` strings
3. Migrate features in order: `auth`, `user`, `contacts`, `tours`, `map`
4. Add Profile language selector
5. Add CI parity script
6. Manual QA: switch locale at runtime, log out/in, reload, PWA reinstall

Rollback: revert PR; localStorage key `tb.locale` is harmless if left behind.

## Open Questions

- Locale code confirmed: `de-CH` (user decision, 2026-04-20)
- Should we also expose `fr-CH` / `it-CH` placeholders now to ease future expansion? (Recommend: no, YAGNI — issue scopes to German only)
- Surface for selector beyond Profile (e.g., pre-auth login screen)? (Issue says Profile only — defer)
