## ADDED Requirements

### Requirement: User profile stores language preference

The `user_profile` table SHALL include a `locale` column of type `text`, nullable, constrained to the set of supported locale codes (`en`, `de-CH`). The `UserProfile` domain entity and Zod schema SHALL expose this field as `locale: SupportedLocaleCode | null`. The repository SHALL read and write this field through `getUserById` and `upsertProfile`.

#### Scenario: Schema accepts supported codes

- **WHEN** `userProfileRowSchema` parses a row with `locale: 'de-CH'`
- **THEN** the resulting entity SHALL have `locale: 'de-CH'`

#### Scenario: Null locale on new profile

- **WHEN** a profile row is created with no locale set
- **THEN** `profile.locale` SHALL be `null`

#### Scenario: DB rejects unsupported code

- **WHEN** an upsert attempts to write `locale: 'fr'`
- **THEN** the database CHECK constraint SHALL reject the write

### Requirement: Profile load hydrates active locale

On successful `useUserProfileStore.loadProfile()`, if `profile.locale` is non-null and differs from the current `useLocaleStore.locale`, the system SHALL invoke `useLocaleStore.setLocale(profile.locale)` so the active UI locale matches the persisted preference.

#### Scenario: Profile locale matches current — no-op

- **WHEN** `loadProfile` resolves with `profile.locale === useLocaleStore.locale`
- **THEN** no `setLocale` call SHALL be made

#### Scenario: Profile locale differs — apply

- **WHEN** the active locale is `en` and `loadProfile` resolves with `profile.locale === 'de-CH'`
- **THEN** `setLocale('de-CH')` SHALL be invoked and the UI SHALL re-render in German on the next reactive tick

#### Scenario: Profile locale null — seed from device

- **WHEN** `loadProfile` resolves and `profile.locale` is `null`
- **THEN** the system SHALL upsert `locale: <currentActiveLocale>` to `user_profile` so the server becomes the source of truth on subsequent loads

### Requirement: Profile language change persists to profile row

When an authenticated user changes their language via the profile language selector, the system SHALL persist the selected locale code to `user_profile.locale` in addition to the existing `user_metadata.locale` write.

#### Scenario: Authenticated user changes to German

- **WHEN** an authenticated user selects `de-CH` in the profile language selector
- **THEN** the system SHALL upsert `user_profile.locale = 'de-CH'` for the current user

#### Scenario: Profile upsert failure is logged but non-blocking

- **WHEN** the `upsertProfile` call fails (network error, 5xx, etc.)
- **THEN** the active UI locale SHALL remain changed, the failure SHALL be logged via the logger composable, and no error SHALL be surfaced to the user

#### Scenario: Unauthenticated language change skips profile write

- **WHEN** an unauthenticated visitor changes the language
- **THEN** the system SHALL update only `localStorage['tb.locale']` and SHALL NOT call the profile repository or `auth.updateUser`

### Requirement: Language selector in profile

The user profile view SHALL include a single-select language control listing all supported locales from the i18n registry. Selecting a locale SHALL invoke `useLocaleStore().setLocale(code)` immediately, with no separate save step.

#### Scenario: Display supported locales

- **WHEN** the profile view is rendered
- **THEN** the language control SHALL display one option per supported locale, with the active locale pre-selected

#### Scenario: Selection applies immediately

- **WHEN** the user selects a different locale option
- **THEN** the system SHALL invoke `setLocale(code)` and the surrounding UI SHALL re-render in the new locale within the next reactive tick

#### Scenario: Choice persists across reload

- **WHEN** the user selects `de-CH` and then reloads the application
- **THEN** the language control SHALL show `de-CH` as the active selection on the next render

#### Scenario: Choice persists across sign-out

- **WHEN** the user selects `de-CH`, signs out, then signs in again on the same device
- **THEN** the active locale SHALL still be `de-CH`

### Requirement: Profile language change syncs to Supabase user metadata

When an authenticated user changes their language via the profile language selector, the system SHALL update Supabase `user_metadata.locale` to the base language code (`en` or `de`) so that subsequent magic link emails are sent in that language.

#### Scenario: Authenticated user changes to German

- **WHEN** an authenticated user selects `de-CH` in the profile language selector
- **THEN** the system SHALL invoke `supabase.auth.updateUser({ data: { locale: 'de' } })` after `setLocale('de-CH')` completes

#### Scenario: Authenticated user changes to English

- **WHEN** an authenticated user selects `en` in the profile language selector
- **THEN** the system SHALL invoke `supabase.auth.updateUser({ data: { locale: 'en' } })`

#### Scenario: Update failure does not break UI

- **WHEN** the `updateUser` call fails (network error, 5xx, etc.)
- **THEN** the active UI locale SHALL remain changed, the failure SHALL be logged via the logger composable, and no error SHALL be surfaced to the user

#### Scenario: Unauthenticated language change

- **WHEN** an unauthenticated visitor changes the language on a public page
- **THEN** the system SHALL update `localStorage['tb.locale']` only and SHALL NOT call `updateUser`
