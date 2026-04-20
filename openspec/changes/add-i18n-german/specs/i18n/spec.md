## ADDED Requirements

### Requirement: Supported locales registry

The system SHALL maintain a registry of supported locales. Initial set MUST be `en` (English) and `de-CH` (Swiss German). English MUST be the fallback.

#### Scenario: Registry exposes supported codes

- **WHEN** any module imports the supported-locales registry
- **THEN** it SHALL receive an array containing at minimum `{ code: 'en', label: 'English' }` and `{ code: 'de-CH', label: 'Deutsch' }`

#### Scenario: Fallback locale is English

- **WHEN** a translation key is missing in the active locale
- **THEN** the system SHALL render the English value for that key

### Requirement: Locale auto-detection on first load

On first application load (no persisted user choice), the system SHALL select the locale by matching `navigator.languages` against supported codes. Region-tagged matches (e.g., `de-AT` → `de-CH`) SHALL fall back to the same base language. If no match, English SHALL be used.

#### Scenario: Browser language matches supported

- **WHEN** the user has no persisted locale and `navigator.languages[0]` is `de-CH`
- **THEN** the active locale on first paint SHALL be `de-CH`

#### Scenario: Browser language matches base only

- **WHEN** the user has no persisted locale and `navigator.languages[0]` is `de-AT`
- **THEN** the active locale SHALL be `de-CH`

#### Scenario: No supported match

- **WHEN** the user has no persisted locale and no `navigator.languages` entry matches a supported code or base
- **THEN** the active locale SHALL be `en`

### Requirement: Locale persistence per device

A user-chosen locale SHALL be persisted in `localStorage` under key `tb.locale`. The persisted value SHALL be read synchronously before the Vue app mounts to avoid a flash of incorrect language. The value SHALL survive sign-out and SHALL NOT be transmitted to Supabase.

#### Scenario: Persist on selection

- **WHEN** the user selects a locale via the profile language selector
- **THEN** the system SHALL write the selected code to `localStorage['tb.locale']` synchronously

#### Scenario: Restore on reload

- **WHEN** the application boots and `localStorage['tb.locale']` contains a supported code
- **THEN** the active locale on first paint SHALL be that code (overriding browser detection)

#### Scenario: Survives sign-out

- **WHEN** the user signs out
- **THEN** `localStorage['tb.locale']` SHALL remain unchanged

#### Scenario: Per-device isolation

- **WHEN** the same authenticated user opens the app on a second device
- **THEN** the locale on the second device SHALL be determined independently (from its own localStorage or detection), not synced from the first device

#### Scenario: Installed PWA isolated from browser (Android)

- **WHEN** the user installs the PWA on Android and selects a locale inside the installed app
- **THEN** the locale in the Chrome browser tab on the same device and account SHALL remain unchanged

#### Scenario: Installed PWA isolated from browser (iOS)

- **WHEN** the user adds the app to Home Screen on iOS (standalone Safari WebApp) and selects a locale there
- **THEN** the locale in the Safari browser tab on the same device and account SHALL remain unchanged

### Requirement: Reactive locale switching

Changing the active locale at runtime SHALL update all rendered translations without a page reload, update `document.documentElement.lang`, and re-evaluate any Zod or validation error messages currently displayed.

#### Scenario: UI updates without reload

- **WHEN** the active locale changes from `en` to `de-CH`
- **THEN** all components using `t()` SHALL re-render with German strings within the next reactive tick

#### Scenario: HTML lang attribute syncs

- **WHEN** the active locale becomes `de-CH`
- **THEN** `document.documentElement.lang` SHALL equal `de-CH`

#### Scenario: Validation messages re-localize

- **WHEN** a form field shows a Zod validation error and the user switches locale
- **THEN** the error text SHALL update to the new locale on the next validation cycle

### Requirement: Type-safe message keys

Translation keys SHALL be type-checked at compile time using the English message catalog as the source of truth. Calls to `t()` with unknown keys SHALL produce a TypeScript error.

#### Scenario: Unknown key is a type error

- **WHEN** a developer writes `t('does.not.exist')`
- **THEN** `npm run type-check` SHALL fail

### Requirement: Locale parity check

CI SHALL fail if any non-English locale catalog is missing keys that exist in the English catalog.

#### Scenario: Missing German key fails CI

- **WHEN** `en.json` contains key `auth.signIn.title` and `de-CH.json` does not
- **THEN** the parity check script SHALL exit non-zero

### Requirement: Locale store

A Pinia store `useLocaleStore` SHALL expose the current locale code as a reactive ref and a `setLocale(code)` action. The action SHALL update vue-i18n, write to localStorage, and update `<html lang>`.

#### Scenario: setLocale rejects unsupported code

- **WHEN** `setLocale('xx-YY')` is called with an unsupported code
- **THEN** the store SHALL not update state and SHALL emit a warning via the logger composable

#### Scenario: setLocale updates all sinks

- **WHEN** `setLocale('de-CH')` is called
- **THEN** the store SHALL update its ref, set `i18n.global.locale.value`, write `localStorage['tb.locale']`, and set `document.documentElement.lang`, in that order

### Requirement: Localized formatting helpers

The system SHALL provide a `useFormatter` composable returning locale-aware date and number formatters backed by `Intl.DateTimeFormat` and `Intl.NumberFormat`.

#### Scenario: Date format follows locale

- **WHEN** `useFormatter().formatDate(date)` is called with active locale `de-CH`
- **THEN** the result SHALL use Swiss German conventions (e.g., `20.04.2026`)
