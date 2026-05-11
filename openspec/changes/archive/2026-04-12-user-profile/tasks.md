## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/14-user-profile`

## 2. Manual Setup: Twilio & Supabase

- [x] 2.1 Create Twilio account at twilio.com (free trial, ~$15 credit). Get phone number with SMS capability. Note Account SID, Auth Token, and phone number from Twilio Console
- [x] 2.2 In Supabase Dashboard → Authentication → Providers → Phone: enable Phone provider, set SMS provider to "Twilio", enter Account SID, Auth Token, and Twilio phone number
- [x] 2.3 In Supabase Dashboard → SQL Editor, run: `ALTER TABLE user_profile DROP COLUMN IF EXISTS date_of_birth;`

## 3. Data Model Updates

- [x] 3.1 Remove `dateOfBirth` from `userProfileSchema` and `userProfileRowSchema` in `user-profile-schema.ts`
- [x] 3.2 Remove `dateOfBirth` from `UserProfile` type (inferred from updated schema) and update `isProfileComplete` to check only `firstName` and `lastName`
- [x] 3.3 Remove `date_of_birth` handling from `UserProfileRepositoryImpl` (upsert and parse)
- [x] 3.4 Create `FullUserProfile` type in `src/features/user/domain/entities/full-user-profile.ts` — unified type: `{ id, firstName, lastName, email, phoneNumber, phoneVerified }`

## 4. Store Updates

- [x] 4.1 Add `fullProfile` computed to `useUserProfileStore` — merges `profile` (id, firstName, lastName) with auth data (email, phoneNumber, phoneVerified)
- [x] 4.2 Add `updateProfile(fields)` action — merge partial fields, call repository, update reactive state
- [x] 4.3 Add `sendPhoneVerification(phone)` action — calls `supabase.auth.updateUser({ phone })`
- [x] 4.4 Add `verifyPhone(phone, token)` action — calls `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })`

## 5. Onboarding Page

- [x] 5.1 Create `onboarding-page.vue` at `src/features/user/presentation/pages/` with form for firstName, lastName, phoneNumber
- [x] 5.2 Add Zod validation schema for onboarding form (firstName/lastName required, phoneNumber optional E.164 format)
- [x] 5.3 Implement skip functionality — set `skippedOnboarding` in localStorage, navigate to `/map`
- [x] 5.4 Add reminder text explaining benefits of complete profile
- [x] 5.5 On submit: save profile via store, trigger phone verification if phone provided, navigate to `/map`

## 6. Phone Verification Component

- [x] 6.1 Create `phone-verification-dialog.vue` component — 6-digit OTP input, verify button, resend with cooldown timer
- [x] 6.2 Wire up verification to store actions (`sendPhoneVerification`, `verifyPhone`)
- [x] 6.3 Handle error states (wrong code, SMS send failure, rate limiting, SMS provider not configured)
- [x] 6.4 Show success state on verified, then dismiss

## 7. Profile Sheet Enhancement

- [x] 7.1 Add edit mode toggle to `user-profile-sheet.vue` — switch between view/edit modes
- [x] 7.2 In view mode: display firstName, lastName, email, phoneNumber with verified badge (blue checkmark) using `fullProfile`
- [x] 7.3 In edit mode: editable inputs for firstName, lastName, phoneNumber with save/cancel buttons
- [x] 7.4 On save: call store `updateProfile` for name fields, trigger phone verification if phone changed
- [x] 7.5 Add "Add phone" prompt when no phone number set, linking to phone verification flow

## 8. Routing & Guards

- [x] 8.1 Add `requiresCompleteProfile` to `RouteMeta` interface
- [x] 8.2 Register `/onboarding` route with `requiresAuth: true`
- [x] 8.3 Add `requiresCompleteProfile: true` to `/map` route meta
- [x] 8.4 Extend `setupRouterGuards` — if authenticated + profile incomplete + no skip flag → redirect to `/onboarding`
- [x] 8.5 Add logic so `/onboarding` redirects to `/map` if profile already complete

## 9. Testing

- [x] 9.1 Unit test `isProfileComplete` with updated logic (no dateOfBirth)
- [x] 9.2 Unit test `FullUserProfile` construction and `fullProfile` computed
- [x] 9.3 Component test onboarding page — form validation, skip, submit flows
- [x] 9.4 Component test profile sheet — view/edit toggle, save, phone verification trigger
- [x] 9.5 Unit test router guard — redirect logic for incomplete/complete/skipped profiles

## 10. Finalize

- [x] 10.1 Run `npm run lint` and fix any issues
- [x] 10.2 Run `npm run format`
- [x] 10.3 Run `npm run test` — all tests pass
- [x] 10.4 Prompt user to commit with message: `feat(user): add profile onboarding, editing, and phone verification (#14)`
- [x] 10.5 Prompt user to push branch and create PR
