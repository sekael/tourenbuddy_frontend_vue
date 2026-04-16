## ADDED Requirements

### Requirement: Canonical phone storage format

The application SHALL store every phone number — whether on a contact method or on the user profile — in canonical international format with a leading `+`, the country code, and the remainder grouped per ITU-T E.123 spaces (e.g. `+41 79 012 34 56`). Empty or null phone values are always permitted because phone is optional everywhere it appears.

#### Scenario: Stored format for new write

- **WHEN** any code path persists a non-empty phone value (contact method create/update, user profile update)
- **THEN** the value written to Supabase SHALL match `^\+\d+( \d+)*$` (leading `+`, digits, optionally separated by single ASCII spaces)

#### Scenario: Empty value stays empty

- **WHEN** a code path persists `null`, `undefined`, or a whitespace-only phone value
- **THEN** the stored value SHALL be `null` and no normalization SHALL be attempted

### Requirement: Phone normalization utility

A `normalizePhone(input, defaultCountry?)` utility SHALL live at `src/core/utils/phone-normalize.ts`, parse the input string against the supplied default region (default: `CH`), and return either `{ ok: true, value: '<canonical international form>' }` or `{ ok: false, raw: '<original trimmed input>' }`. Parsing SHALL accept inputs starting with `+`, `00`, or in the default region's national form.

#### Scenario: Swiss national input

- **WHEN** `normalizePhone('079 123 45 67')` is called
- **THEN** the result SHALL be `{ ok: true, value: '+41 79 123 45 67' }`

#### Scenario: International plus-prefixed input

- **WHEN** `normalizePhone('+41791234567')` is called
- **THEN** the result SHALL be `{ ok: true, value: '+41 79 123 45 67' }`

#### Scenario: International 00-prefixed input

- **WHEN** `normalizePhone('0041 79 123 45 67')` is called
- **THEN** the result SHALL be `{ ok: true, value: '+41 79 123 45 67' }`

#### Scenario: Foreign number with country code

- **WHEN** `normalizePhone('+33 6 12 34 56 78')` is called
- **THEN** the result SHALL be `{ ok: true, value: '+33 6 12 34 56 78' }`

#### Scenario: Default-country override

- **WHEN** `normalizePhone('06 12 34 56 78', 'FR')` is called
- **THEN** the result SHALL be `{ ok: true, value: '+33 6 12 34 56 78' }`

#### Scenario: Unparseable input

- **WHEN** `normalizePhone('not a number')` is called
- **THEN** the result SHALL be `{ ok: false, raw: 'not a number' }`

#### Scenario: Empty input

- **WHEN** `normalizePhone('')` or `normalizePhone('   ')` is called
- **THEN** the result SHALL be `{ ok: false, raw: '' }` and callers SHALL treat this as "no phone to store"

### Requirement: E.164 conversion for verification flows

A `toE164(input, defaultCountry?)` utility SHALL be exposed alongside `normalizePhone` and return the same number in E.164 form (no spaces, e.g. `+41791234567`) for use only by transport calls that require it (Supabase Auth `signInWithOtp`). It SHALL return `null` when the input cannot be parsed.

#### Scenario: Convert canonical for OTP

- **WHEN** `toE164('+41 79 123 45 67')` is called
- **THEN** the result SHALL be `'+41791234567'`

#### Scenario: Convert national for OTP

- **WHEN** `toE164('079 123 45 67')` is called
- **THEN** the result SHALL be `'+41791234567'`

#### Scenario: Unparseable input

- **WHEN** `toE164('not a number')` is called
- **THEN** the result SHALL be `null`

### Requirement: Live as-you-type formatting composable

A `useAsYouTypePhone(rawRef, defaultCountry?)` composable SHALL wrap libphonenumber-js's `AsYouType` formatter and expose:

- `formatted: Ref<string>` — the input string formatted for display, updated on every change to `rawRef`.
- A bound input handler that updates `rawRef` from a new value while preserving the user's caret position relative to the digits they typed.

#### Scenario: Format updates on every keystroke

- **WHEN** the user types `0791234567` one digit at a time into a phone input bound through `useAsYouTypePhone`
- **THEN** the displayed value SHALL update progressively (e.g. `079 1`, `079 12`, `079 123`, `079 123 4`, …) until reaching the final formatted form

#### Scenario: International prefix triggers international grouping

- **WHEN** the user types `+41791234567` into a phone input bound through `useAsYouTypePhone`
- **THEN** the displayed value SHALL progress to `+41 79 123 45 67`

#### Scenario: Caret stays with typed digits

- **WHEN** the user inserts a digit in the middle of an existing formatted value (e.g. cursor at index 4 in `+41 79`, types `5`)
- **THEN** after reformatting the cursor SHALL remain immediately after the inserted digit, not jump to the end of the input

### Requirement: Display normalization for legacy data

The `formatPhoneDisplay(value)` function in `src/features/contacts/domain/entities/contact.ts` SHALL invoke `normalizePhone` and return the canonical form on success, or the trimmed original value on failure. This guarantees consistent rendering of pre-existing rows that were written before this change.

#### Scenario: Legacy 00-prefix value

- **WHEN** `formatPhoneDisplay('0041791234567')` is called for a row written before this change
- **THEN** the result SHALL be `'+41 79 123 45 67'`

#### Scenario: Legacy local value

- **WHEN** `formatPhoneDisplay('0791234567')` is called for a row written before this change
- **THEN** the result SHALL be `'+41 79 123 45 67'` (using the default region `CH`)

#### Scenario: Unrecognized legacy value

- **WHEN** `formatPhoneDisplay('ext. 1234')` is called
- **THEN** the result SHALL be `'ext. 1234'` (the trimmed original)

### Requirement: Normalization at the persistence boundary

The contacts Pinia store actions (`addContact`, `addMethodToContact`, `updateMethodOnContact`) SHALL normalize any non-empty phone value via `normalizePhone` before invoking the repository. A successful normalization replaces the value with the canonical form. A failed normalization on a non-empty input SHALL throw an `InvalidPhoneNumberError` exposed via the store's error state, blocking the write. The user-profile store SHALL apply the same rule before any write to `user_profiles.phone_number` and before invoking phone verification.

#### Scenario: Store rewrites unnormalized input

- **WHEN** `contactsStore.addContact('Max', 'Muster', null, '079 123 45 67')` is called
- **THEN** the repository call SHALL receive a phone value of `'+41 79 123 45 67'`

#### Scenario: Store rejects unparseable input

- **WHEN** `contactsStore.addContact('Max', 'Muster', null, 'not a number')` is called
- **THEN** an `InvalidPhoneNumberError` SHALL be raised and surfaced via the store's `error` state, and the repository SHALL NOT be called

#### Scenario: Store accepts empty input

- **WHEN** `contactsStore.addContact('Max', 'Muster', null, '')` or `…null)` is called
- **THEN** the repository SHALL be called with `phoneNumber: null` and no error SHALL be raised

#### Scenario: User profile uses canonical for storage and E.164 for verification

- **WHEN** the user-profile store saves a phone of `'079 123 45 67'`
- **THEN** the value written to `user_profiles.phone_number` SHALL be `'+41 79 123 45 67'`
- **AND** the value passed to Supabase Auth's `signInWithOtp` SHALL be `'+41791234567'`
