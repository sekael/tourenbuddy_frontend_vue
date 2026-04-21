## Why

App is English-only. Primary user base is Swiss/German-speaking tour planners. German support unblocks adoption and matches Swisstopo + Swiss-context domain.

## What Changes

- Add Vue i18n infrastructure (`vue-i18n` v11, composition API, type-safe message keys)
- Extract all user-facing strings (components, pages, validation messages, snackbar feedback, error messages, button labels, form labels, empty states) into locale message files
- Add German (`de-CH`) translations alongside English (`en`)
- Auto-detect locale from `navigator.language` on first load; default to English if no match
- Persist user-selected locale in `localStorage` (per-device, survives logout)
- Add language single-select control in User Profile view
- Apply `<html lang>` attribute reactively to active locale
- Localize phone validation, Zod error messages, date formatting (Intl)

## Capabilities

### New Capabilities

- `i18n`: Locale detection, message catalog management, runtime locale switching, persistence, `<html lang>` sync, formatting helpers (numbers, dates) per locale.

### Modified Capabilities

- `user-profile`: Adds language selector control in profile view.
- `user-feedback`: Snackbar/error messages routed through i18n message keys.
- `phone-formatting`: Validation/error messages localized.
- `design-system`: Components consuming hard-coded strings refactored to `t()` calls.

## Impact

- Dependency: add `vue-i18n@^11`
- New dir: `src/core/i18n/` (config, locale detection, types) + `src/locales/{en,de-CH}/`
- Touches every component with literal user-facing text (broad surface, mechanical edits)
- New Pinia store (or composable) for locale state, hydrated from `localStorage`
- Bundle size: ~30 KB gz for vue-i18n + message catalogs (acceptable)
- No backend changes — locale not stored in Supabase
- PWA: locale assets precached; switching locale does not require reload
