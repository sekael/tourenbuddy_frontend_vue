## Why

Users currently land on the map after login with no opportunity to set up their profile. The existing `UserProfile` entity stores `firstName`, `lastName`, and `dateOfBirth` — but `dateOfBirth` is unused and the issue requires `email` and `phone number` with SMS verification instead. Without profile completion and phone verification, tour partners cannot reliably contact each other, undermining the core value of the app.

## What Changes

- **Simplify user profile model** — remove `dateOfBirth`, keep `id`/`firstName`/`lastName` in `user_profile` table. Create unified `FullUserProfile` type combining `user_profile` fields with auth-derived `email`, `phoneNumber`, `phoneVerified`
- **Profile onboarding flow** — after first login, redirect to an onboarding page where users enter first name, last name, and phone number. Users can skip but see a reminder that a complete profile improves the experience
- **Profile view/edit** — replace the current display-only profile sheet with a full profile view that shows all fields and allows inline editing
- **Phone verification** — when a phone number is entered (onboarding or profile edit), trigger Supabase SMS OTP verification. Display a code entry form, and on success set `phoneVerified = true`
- **Verified badge** — show a blue checkmark icon next to verified phone numbers in the profile view
- **Routing guard** — add a `profileIncomplete` check that redirects first-time users to onboarding after authentication

## Capabilities

### New Capabilities

- `profile-onboarding`: First-login onboarding page with skip option and profile completion form
- `phone-verification`: SMS OTP verification flow for phone numbers using Supabase, with verified badge display

### Modified Capabilities

- `user-profile`: Remove `dateOfBirth`, add unified `FullUserProfile` type merging profile + auth data, add profile editing UI, update completeness check

## Impact

- **Database**: `user_profile` table needs `date_of_birth` column dropped — Supabase migration via dashboard
- **Routing**: New `/onboarding` route, new router guard to redirect incomplete profiles
- **Auth integration**: Phone verification uses `supabase.auth.updateUser({ phone })` and `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })` — requires Supabase SMS provider configured (Twilio)
- **Manual setup**: Twilio account creation (free tier), Supabase Phone Auth provider configuration in dashboard
- **Existing code**: `UserProfile` entity, Zod schema, repository, store, and profile sheet all need updates
- **Dependencies**: No new npm dependencies required
