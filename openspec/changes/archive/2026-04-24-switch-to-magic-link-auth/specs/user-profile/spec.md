## ADDED Requirements

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
