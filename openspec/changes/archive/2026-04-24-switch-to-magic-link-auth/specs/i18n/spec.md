## MODIFIED Requirements

### Requirement: Locale persistence per device

A user-chosen locale SHALL be persisted in `localStorage` under key `tb.locale`. The persisted value SHALL be read synchronously before the Vue app mounts to avoid a flash of incorrect language. The value SHALL survive sign-out. The value SHALL NOT be transmitted to Supabase as the source of truth for the UI locale; per-device UI isolation MUST be preserved. A separate, derived value (the base language code, `en` or `de`) MAY be written to Supabase `user_metadata.locale` for the sole purpose of selecting the recipient's email template (see `auth` and `user-profile` specs).

#### Scenario: Persist on selection

- **WHEN** the user selects a locale via the profile language selector
- **THEN** the system SHALL write the selected code to `localStorage['tb.locale']` synchronously

#### Scenario: Restore on reload

- **WHEN** the application boots and `localStorage['tb.locale']` contains a supported code
- **THEN** the active locale on first paint SHALL be that code (overriding browser detection)

#### Scenario: Survives sign-out

- **WHEN** the user signs out
- **THEN** `localStorage['tb.locale']` SHALL remain unchanged

#### Scenario: Per-device isolation for UI

- **WHEN** the same authenticated user opens the app on a second device
- **THEN** the UI locale on the second device SHALL be determined independently (from its own localStorage or detection), not synced from the first device

#### Scenario: Email locale follows latest device choice

- **WHEN** the same authenticated user changes language on device B after previously using device A
- **THEN** subsequent magic link emails SHALL be sent in the language chosen on device B (because `user_metadata.locale` was updated by device B), even though device A's UI is unaffected

#### Scenario: Installed PWA isolated from browser (Android)

- **WHEN** the user installs the PWA on Android and selects a locale inside the installed app
- **THEN** the locale in the Chrome browser tab on the same device and account SHALL remain unchanged

#### Scenario: Installed PWA isolated from browser (iOS)

- **WHEN** the user adds the app to Home Screen on iOS (standalone Safari WebApp) and selects a locale there
- **THEN** the locale in the Safari browser tab on the same device and account SHALL remain unchanged

## ADDED Requirements

### Requirement: Locale-to-email-locale normalization

The system SHALL provide a pure function that maps a supported i18n locale code to a base email locale code in the set `{en, de}`. This function MUST be used by every call site that writes `user_metadata.locale`.

#### Scenario: Swiss German maps to base German

- **WHEN** the function is called with `de-CH`
- **THEN** it SHALL return `de`

#### Scenario: English maps to itself

- **WHEN** the function is called with `en`
- **THEN** it SHALL return `en`

#### Scenario: Unknown input falls back to English

- **WHEN** the function is called with an unsupported code
- **THEN** it SHALL return `en`
