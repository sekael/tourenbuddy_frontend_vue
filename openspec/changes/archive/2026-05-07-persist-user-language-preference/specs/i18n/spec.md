## MODIFIED Requirements

### Requirement: Locale persistence per device

A user-chosen locale SHALL be persisted in `localStorage` under key `tb.locale` as a boot-time cache to prevent flashing the wrong language on cold reload. The persisted value SHALL be read synchronously before the Vue app mounts. The value SHALL survive sign-out. For authenticated users, `localStorage` is NOT the source of truth — the user's `user_profile.locale` (see `user-profile` spec) overrides it once the profile loads. For unauthenticated visitors, `localStorage` remains the only persistence.

#### Scenario: Persist on selection (cache)

- **WHEN** the user selects a locale via the profile language selector
- **THEN** the system SHALL write the selected code to `localStorage['tb.locale']` synchronously

#### Scenario: Restore on cold boot (cache)

- **WHEN** the application boots and `localStorage['tb.locale']` contains a supported code
- **THEN** the active locale on first paint SHALL be that code (overriding browser detection)

#### Scenario: Survives sign-out

- **WHEN** the user signs out
- **THEN** `localStorage['tb.locale']` SHALL remain unchanged

#### Scenario: Profile overrides cache after load

- **WHEN** an authenticated user's `user_profile.locale` is loaded and differs from the boot-time active locale
- **THEN** the system SHALL invoke `useLocaleStore.setLocale(profile.locale)` so the UI re-renders in the persisted preference

#### Scenario: Cross-device sync via profile

- **WHEN** the same authenticated user opens the app on a second device after selecting `de-CH` on the first
- **THEN** the second device SHALL render the UI in `de-CH` once `user_profile.locale` is loaded, regardless of its local `localStorage['tb.locale']` value

#### Scenario: Unauthenticated visitor remains per-device

- **WHEN** an unauthenticated visitor selects a locale
- **THEN** persistence SHALL be limited to `localStorage['tb.locale']` and SHALL NOT propagate across devices

### Requirement: Locale store

A Pinia store `useLocaleStore` SHALL expose the current locale code as a reactive ref and a `setLocale(code)` action. The action SHALL update vue-i18n, write to `localStorage`, update `<html lang>`, write through to the user's profile (if authenticated and profile loaded), and update `user_metadata.locale` (for email templating).

#### Scenario: setLocale rejects unsupported code

- **WHEN** `setLocale('xx-YY')` is called with an unsupported code
- **THEN** the store SHALL not update state and SHALL emit a warning via the logger composable

#### Scenario: setLocale updates all sinks (authenticated)

- **WHEN** `setLocale('de-CH')` is called and the user is authenticated with a loaded profile
- **THEN** the store SHALL update its ref, set `i18n.global.locale.value`, write `localStorage['tb.locale']`, set `document.documentElement.lang`, persist to `user_profile.locale`, and update `user_metadata.locale`

#### Scenario: setLocale skips profile write when profile not loaded

- **WHEN** `setLocale('de-CH')` is called before `useUserProfileStore.profile` is populated
- **THEN** the store SHALL update i18n, localStorage, and `<html lang>`, SHALL NOT throw, and SHALL NOT attempt the profile upsert; the next change after profile load SHALL persist

#### Scenario: Profile write failure does not break UI

- **WHEN** the profile upsert call fails
- **THEN** the active UI locale SHALL remain changed and the failure SHALL be logged via the logger composable
