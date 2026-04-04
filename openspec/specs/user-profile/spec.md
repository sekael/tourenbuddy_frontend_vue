## ADDED Requirements

### Requirement: User profile model with Zod validation

A Zod schema SHALL define the user profile shape: `id` (string), `firstName` (string, nullable), `lastName` (string, nullable), `dateOfBirth` (date, nullable). The TypeScript type SHALL be inferred from the schema.

#### Scenario: Valid profile from Supabase

- **WHEN** a profile row is fetched from the `user_profile` table
- **THEN** the Zod schema SHALL parse it into a typed `UserProfile` object with snake_case to camelCase mapping

#### Scenario: Profile completeness check

- **WHEN** checking if a profile is complete
- **THEN** the profile SHALL be considered complete when `firstName`, `lastName`, and `dateOfBirth` are all non-null

### Requirement: User profile repository

A repository SHALL provide methods to fetch, update, and upsert user profiles from the `user_profile` Supabase table.

#### Scenario: Fetch profile by user ID

- **WHEN** `getUserById(userId)` is called
- **THEN** the repository SHALL SELECT from `user_profile` where `id` matches and return the parsed profile or null

#### Scenario: Upsert profile

- **WHEN** `upsertProfile(profile)` is called
- **THEN** the repository SHALL INSERT or UPDATE the `user_profile` row, validating that the current user matches the profile ID

### Requirement: User profile store

A Pinia store (`useUserProfileStore`) SHALL manage the current user's profile data, with reactive `profile`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the user profile store SHALL automatically fetch the current user's profile (creating one if it doesn't exist)

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the user profile store SHALL clear its cached profile data

### Requirement: User profile sheet component

A profile sheet component SHALL display the current user's name and email, and provide a sign-out button.

#### Scenario: Display profile info

- **WHEN** the profile sheet is opened
- **THEN** it SHALL show the user's first name, last name, and email address from the auth session

#### Scenario: Sign out action

- **WHEN** the user clicks the sign-out button
- **THEN** the auth store's `signOut()` SHALL be called, the sheet SHALL close, and the user SHALL be redirected to the home page
