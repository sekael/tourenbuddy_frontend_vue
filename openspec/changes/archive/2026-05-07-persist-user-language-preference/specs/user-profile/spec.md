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
