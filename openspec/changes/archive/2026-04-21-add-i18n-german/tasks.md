## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/62-i18n-german`

## 2. Dependencies & Build Wiring

- [x] 2.1 Install `vue-i18n@^11` and `@intlify/unplugin-vue-i18n` as deps
- [x] 2.2 Configure `@intlify/unplugin-vue-i18n` in `vite.config.ts` with `compositionOnly: true`, `strictMessage: true`, `escapeHtml: true`, include `src/locales/**`
- [x] 2.3 Verify `npm run dev` boots and `npm run type-check` passes

## 3. Core i18n Infrastructure

- [x] 3.1 Create `src/core/i18n/supported.ts` exporting `SUPPORTED_LOCALES` (`en`, `de-CH`) with code/label
- [x] 3.2 Create `src/core/i18n/detect.ts` with `detectLocale()` matching `navigator.languages` against supported, base-language fallback, English default
- [x] 3.3 Create `src/core/i18n/persistence.ts` with `readPersistedLocale()` / `writePersistedLocale(code)` using `localStorage` key `tb.locale`
- [x] 3.4 Create `src/core/i18n/index.ts` instantiating vue-i18n with resolved locale (persisted ?? detected ?? `en`), fallbackLocale `en`, legacy `false`, globalInjection `false`
- [x] 3.5 Create empty `src/locales/en.json` and `src/locales/de-CH.json`
- [x] 3.6 Add module augmentation in `src/types/vue-i18n.d.ts` so `t()` infers keys from `en.json`
- [x] 3.7 Wire i18n install in `src/main.ts` BEFORE `app.mount`
- [x] 3.8 Add `watchEffect` in `App.vue` setting `document.documentElement.lang` from active locale

## 4. Locale Store

- [x] 4.1 Create `useLocaleStore` Pinia composition store at `src/features/i18n/presentation/stores/use-locale-store.ts` with `locale` ref + `setLocale(code)` action that validates supported, updates `i18n.global.locale.value`, writes localStorage, sets `<html lang>`, logs warning on unsupported
- [x] 4.2 Hydrate store from current `i18n.global.locale.value` on creation
- [x] 4.3 Verify sign-out flow does NOT clear `tb.locale` (audit `useAuthStore.signOut`)

## 5. Formatting Helpers

- [x] 5.1 Create `useFormatter` composable at `src/core/composables/use-formatter.ts` exposing `formatDate(date, options?)` and `formatNumber(value, options?)` reactive to active locale
- [x] 5.2 Replace any existing hard-coded date formatting calls with `useFormatter`

## 6. Validation Localization

- [x] 6.1 Install Zod global error map in `src/core/i18n/zod-error-map.ts` mapping issue codes to `t('validation.<code>')` keys
- [x] 6.2 Re-install error map on locale change via watcher in `i18n` setup
- [x] 6.3 Update `usePhoneValidation` (or equivalent) to return key + params instead of literal strings; consumers translate at render

## 7. String Extraction — Core

- [x] 7.1 Extract literals from `src/core/components/**` (snackbar, bottom-sheet, drawer, crosshair, etc.) into `en.json` namespaces; replace with `t()`
- [x] 7.2 Extract literals from `src/core/composables/**` user-facing messages

## 8. String Extraction — Features

- [x] 8.1 Migrate `features/auth/**` (sign-in form, OTP, errors)
- [x] 8.2 Migrate `features/user/**` (profile sheet, edit form, phone verification)
- [x] 8.3 Migrate `features/contacts/**` (list, edit, vCard import, chip actions)
- [x] 8.4 Migrate `features/tours/**` (list, form, GPX upload, elevation/name suggestion UI)
- [x] 8.5 Migrate `features/map/**` user-facing labels and tooltips

## 9. German Catalog

- [x] 9.1 Translate every key in `en.json` to `de-CH.json`, preserving namespaces
- [x] 9.2 Verify Swiss German conventions (no ß; `Sie` form for user-facing text)

## 10. Profile Language Selector

- [x] 10.1 Add language single-select control to `UserProfilePage` (or profile edit view) listing `SUPPORTED_LOCALES`
- [x] 10.2 Bind selection to `useLocaleStore().setLocale`
- [x] 10.3 Translate labels for the selector itself in both catalogs

## 11. CI Parity Check

- [x] 11.1 Add `scripts/check-locale-parity.ts` that loads both catalogs, recursively diffs key paths, exits non-zero on missing keys (allows extra de-CH keys but warns)
- [x] 11.2 Wire script into `package.json` as `check:locales` and add to CI workflow `analyze-and-test.yml` after lint step

## 12. Tests

- [x] 12.1 Unit test `detectLocale()` against fixture `navigator.languages` arrays
- [x] 12.2 Unit test `useLocaleStore.setLocale` (supported, unsupported, all sinks updated)
- [x] 12.3 Component test for profile language selector (renders options, switching applies, snackbar in new locale)
- [x] 12.4 Update existing component tests broken by string changes — assert via testid + i18n key, not literal text
- [x] 12.5 Test that `signOut` preserves `localStorage['tb.locale']`

## 13. Manual QA

- [ ] 13.1 Fresh load with browser set to German → app loads in German
- [ ] 13.2 Fresh load with browser set to Japanese → app loads in English
- [ ] 13.3 Switch locale in profile → all visible UI updates without reload, `<html lang>` updates
- [ ] 13.4 Reload after switch → choice retained
- [ ] 13.5 Sign out → sign in → locale retained
- [ ] 13.6 Install PWA on Android (Chrome), set German there, verify Chrome browser tab on same account stays in prior locale
- [ ] 13.7 Add to Home Screen on iOS (Safari standalone), set German there, verify Safari browser tab on same account stays in prior locale
- [ ] 13.8 Verify boot has no flash of English on slow iOS Safari WebApp launch (sync localStorage read effective)
- [ ] 13.9 Trigger Zod and phone validation errors in both locales

## 14. Finalize

- [x] 14.1 `npm run lint && npm run format && npm run type-check && npm run test`
- [x] 14.2 Prompt user to commit with message: `feat(i18n): add internationalization with German support (#62)`
- [x] 14.3 Prompt user to push branch and open PR linking issue #62
- [x] 14.4 After merge, prompt user to archive change with `/opsx:archive`
