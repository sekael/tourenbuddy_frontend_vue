# Tasks

## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/113-persist-user-language-preference`

## 2. Database

- [x] 2.1 Create migration `supabase/migrations/<YYYYMMDD>_user_profile_locale.sql`:
  - `ALTER TABLE user_profile ADD COLUMN locale text;`
  - `ALTER TABLE user_profile ADD CONSTRAINT user_profile_locale_check CHECK (locale IS NULL OR locale IN ('en', 'de-CH'));`
- [x] 2.2 Apply migration locally; verify column + constraint via `psql` / Supabase Studio.

## 3. Domain & Data Layer

- [x] 3.1 Extend `src/features/user/data/models/user-profile-schema.ts`:
  - Add `locale: z.enum(['en', 'de-CH']).nullable()` to `userProfileSchema`.
  - Add `locale: z.enum(['en', 'de-CH']).nullable()` to `userProfileRowSchema`; map in transform.
- [x] 3.2 Verify `UserProfile` entity reflects new field (type-only, auto via z.infer).
- [x] 3.3 Update `UserProfileRepositoryImpl.upsertProfile` to include `locale` in the row payload (snake_case if needed — column is already snake `locale`).
- [x] 3.4 Update `UserProfileRepositoryImpl.getUserById` mapping (covered if it already runs through `userProfileRowSchema`).

## 4. Locale Store Write-Through

- [x] 4.1 Add `setLocale(code)` action to `useUserProfileStore` that calls `updateProfile({ locale: code })` and no-ops when `profile.value` is null. Log failures via `useLogger`, do not throw.
- [x] 4.2 In `useLocaleStore.setLocale`, after updating i18n/localStorage/`<html lang>` and before/after `auth.updateUser`, call `useUserProfileStore().setLocale(code)` only when an authenticated session exists. Keep behaviour fire-and-forget.
- [x] 4.3 Ensure unauthenticated path is unchanged (no profile write, no auth metadata write).

## 5. Hydration on Profile Load

- [x] 5.1 In `useUserProfileStore.loadProfile`, after assigning `profile.value`:
  - If `profile.value.locale` is non-null and differs from current locale, call `useLocaleStore().setLocale(profile.value.locale)`.
  - If `profile.value.locale` is null, call `repository.upsertProfile({ ...profile.value, locale: useLocaleStore().locale })` and update `profile.value` to seed the server.
- [x] 5.2 Guard against re-entrant `setLocale` writing back to profile during hydration (e.g., pass an internal flag, or detect equality before write in step 4.2).

## 6. Tests

- [x] 6.1 Schema tests: parse rows with `locale: 'en'`, `'de-CH'`, `null`; assert mapping. Reject `'fr'` at schema level.
- [x] 6.2 Repository test (mocked Supabase): `upsertProfile({ locale: 'de-CH' })` sends column `locale` in payload.
- [x] 6.3 `useUserProfileStore.loadProfile` tests:
  - Hydrates locale via `setLocale` when `profile.locale !== current`.
  - Skips `setLocale` when equal.
  - Seeds server when `profile.locale === null`.
- [x] 6.4 `useLocaleStore.setLocale` tests:
  - Authenticated + profile loaded → calls `userProfileStore.setLocale`.
  - Authenticated + profile null → does NOT call profile setLocale; does not throw.
  - Unauthenticated → no profile or auth metadata write.
  - Profile upsert rejection logged, UI locale stays changed.
- [x] 6.5 Update existing locale-store tests for the new branch.

## 7. Verification

- [x] 7.1 `npm run type-check` clean.
- [x] 7.2 `npm run test` all green.
- [x] 7.3 Manual: sign in on browser A, switch to `de-CH`; sign in on browser B (fresh localStorage) → UI flips to German after profile load.
- [x] 7.4 Manual: send a magic link after change → email arrives in matching language (sanity check `user_metadata.locale` still updated).

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix` (zero warnings).
- [x] 8.2 Prompt user to commit (do NOT auto-commit). Suggested message:
  ```
  feat(user): persist language preference on user profile (#113)

  Adds user_profile.locale column, hydrates UI locale from profile on
  load, and writes through on language change so the choice follows
  the user across devices and platforms.
  ```
- [x] 8.3 Prompt user to push branch and open PR against `main` linking issue #113.
- [x] 8.4 After merge, run `openspec-archive` to archive this change.
