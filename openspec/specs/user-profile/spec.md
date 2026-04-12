## ADDED Requirements

### Requirement: User profile model with Zod validation

A Zod schema SHALL define the user profile shape: `id` (string), `firstName` (string, nullable), `lastName` (string, nullable). The `dateOfBirth` field has been removed from the schema and database. The TypeScript type SHALL be inferred from the schema.

#### Scenario: Valid profile from Supabase

- **WHEN** a profile row is fetched from the `user_profile` table
- **THEN** the Zod schema SHALL parse it into a typed `UserProfile` object with snake_case to camelCase mapping, containing only `id`, `firstName`, and `lastName`

#### Scenario: Profile completeness check

- **WHEN** checking if a profile is complete
- **THEN** the profile SHALL be considered complete when `firstName` and `lastName` are both non-null

### Requirement: User profile repository

A repository SHALL provide methods to fetch, update, and upsert user profiles from the `user_profile` Supabase table.

#### Scenario: Fetch profile by user ID

- **WHEN** `getUserById(userId)` is called
- **THEN** the repository SHALL SELECT from `user_profile` where `id` matches and return the parsed profile or null

#### Scenario: Upsert profile

- **WHEN** `upsertProfile(profile)` is called
- **THEN** the repository SHALL INSERT or UPDATE the `user_profile` row, validating that the current user matches the profile ID

### Requirement: FullUserProfile unified domain type

A `FullUserProfile` type SHALL unify data from the `user_profile` table and `auth.users` into a single domain entity for presentation layer consumption.

#### Scenario: Type shape

- **WHEN** a `FullUserProfile` is constructed
- **THEN** it SHALL contain `id` (string), `firstName` (string | null), `lastName` (string | null), `email` (string), `phoneNumber` (string | null), `phoneVerified` (boolean)

#### Scenario: Components use unified type

- **WHEN** Vue components need user profile data
- **THEN** they SHALL use `fullProfile` from the store, never accessing auth store directly for profile-related data

### Requirement: User profile store

A Pinia store (`useUserProfileStore`) SHALL manage the current user's profile data, with reactive `profile`, `isLoading`, and `error` state. The store SHALL expose a unified `fullProfile` computed that merges profile table data with auth-derived data.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the user profile store SHALL automatically fetch the current user's profile (creating one if it doesn't exist)

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the user profile store SHALL clear its cached profile data

#### Scenario: Update profile fields

- **WHEN** `updateProfile(fields)` is called with partial profile data
- **THEN** the store SHALL merge fields with the existing profile and call `upsertProfile` on the repository

#### Scenario: Unified full profile view

- **WHEN** components access `fullProfile` from the store
- **THEN** it SHALL return a `FullUserProfile` object combining `id`, `firstName`, `lastName` from the profile table with `email` from `authStore.currentUser.email`, `phoneNumber` from `authStore.currentUser.phone`, and `phoneVerified` from `authStore.currentUser.phone_confirmed_at != null`

### Requirement: User profile sheet component

A profile sheet component SHALL display the current user's name, email, phone number (with verification badge), and provide edit and sign-out actions. The sheet SHALL include a drag handle indicator at the top. The close button SHALL use Material Symbols `close` icon. The sign-out button SHALL use Material Symbols `logout` icon alongside the text. The avatar circle SHALL use `--color-primary` background. The sheet SHALL use `--shadow-lg` and `--color-surface` background.

#### Scenario: Display profile info

- **WHEN** the profile sheet is opened
- **THEN** it SHALL show the user's first name, last name, email, and phone number (if set) with verification badge status

#### Scenario: Edit mode

- **WHEN** the user clicks an "Edit" button on the profile sheet
- **THEN** name fields SHALL become editable inputs, and a save/cancel action pair SHALL be shown

#### Scenario: Save profile edits

- **WHEN** the user saves edits in the profile sheet
- **THEN** the store's `updateProfile` SHALL be called and the sheet SHALL return to view mode on success

#### Scenario: Edit phone number

- **WHEN** the user edits their phone number in the profile sheet
- **THEN** saving SHALL trigger the phone verification flow (SMS OTP)

#### Scenario: Sign out action

- **WHEN** the user clicks the sign-out button
- **THEN** the auth store's `signOut()` SHALL be called, the sheet SHALL close, and the user SHALL be redirected to the home page

#### Scenario: Profile sheet displays Material Symbols

- **WHEN** user opens the profile sheet
- **THEN** the close button shows a `close` icon and sign-out button shows a `logout` icon

#### Scenario: Profile sheet has drag handle

- **WHEN** the profile sheet is visible
- **THEN** a small rounded drag handle bar is visible at the top of the sheet
