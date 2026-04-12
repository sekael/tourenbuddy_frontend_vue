## Context

TourenBuddy has a minimal `UserProfile` entity (`id`, `firstName`, `lastName`, `dateOfBirth`) with a display-only profile sheet and no editing UI. The `isProfileComplete` helper exists but is unused. After OTP login, users go straight to `/map` with no onboarding. Phone numbers are not stored or verified. `dateOfBirth` is unused across the app and will be removed.

The Supabase auth system already handles email OTP. Phone verification needs Supabase's phone OTP capability, which requires a configured SMS provider (Twilio) on the Supabase project.

## Goals / Non-Goals

**Goals:**

- Remove `dateOfBirth` from profile model (unused, not in issue requirements)
- Create unified `FullUserProfile` type merging `user_profile` table data with `auth.users` data
- Build onboarding flow for first-time users (skippable)
- Enable profile viewing and editing from the profile sheet
- Implement phone number verification via Supabase SMS OTP
- Display verification badge for verified numbers

**Non-Goals:**

- OAuth or social login integration
- Profile photo/avatar upload
- Offline profile editing with sync
- Admin panel for managing user profiles
- Phone number as alternative login method (verification only, not auth)

## Decisions

### 1. Unified `FullUserProfile` type

**Decision:** Create a `FullUserProfile` domain entity that combines data from two sources:

- `user_profile` table: `id`, `firstName`, `lastName`
- `auth.users` (via `currentUser`): `email`, `phoneNumber`, `phoneVerified`

The store exposes a single `fullProfile` computed that merges both sources. Components only interact with `FullUserProfile` — they never need to know which backend stores which field.

**Rationale:** Single source of truth for UI. Avoids components importing from both auth and profile stores. Clean separation — data layer knows about two sources, presentation layer sees one.

**Shape:**

```ts
interface FullUserProfile {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  phoneNumber: string | null
  phoneVerified: boolean
}
```

### 2. Remove `dateOfBirth` from model

**Decision:** Drop `dateOfBirth` from `UserProfile` entity, Zod schema, repository, and Supabase `user_profile` table. Requires manual column drop in Supabase dashboard.

**Rationale:** Issue #14 doesn't mention date of birth. Field was never used in any UI. Removing it keeps the model aligned with actual requirements.

### 3. Phone verification via Supabase `updateUser` + phone OTP

**Decision:** Use `supabase.auth.updateUser({ phone })` to set the phone on the auth user, then `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })` to verify it. Derive `phoneVerified` from `auth.users.phone_confirmed_at`.

**Rationale:** Supabase natively tracks phone verification on `auth.users`. Using this avoids duplicating verification state. The `phone_confirmed_at` field is set automatically when verification succeeds.

**Alternative considered:** Custom `phone_verified` column on `user_profile` table — rejected because it duplicates Supabase auth state and can drift out of sync.

### 4. Onboarding as a separate route with router guard

**Decision:** Add `/onboarding` route with `requiresAuth: true`. After login, router guard checks `isProfileComplete()` — if incomplete, redirect to `/onboarding`. Users can skip via `skippedOnboarding` flag in localStorage.

**Rationale:** Dedicated route is cleaner than modal overlay. Router guard ensures first-time users always see onboarding. localStorage skip flag persists across sessions without DB column.

**Alternative considered:** Modal dialog on map page — rejected because it blocks primary UI and feels intrusive.

### 5. Profile editing inline in the profile sheet

**Decision:** Extend existing `UserProfileSheet` with "Edit" mode toggle. In edit mode, fields become editable form inputs. Save triggers `upsertProfile` for name fields and `updateUser` for phone.

**Rationale:** Keeps profile interaction in one place. No new route needed. Sheet pattern already established.

### 6. Route meta extension for onboarding guard

**Decision:** Add `requiresCompleteProfile?: boolean` to `RouteMeta`. The `/map` route gets this flag. Guard logic: if authenticated + profile incomplete + not skipped → redirect to `/onboarding`.

**Rationale:** Declarative, consistent with existing `requiresAuth` / `redirectIfAuth` pattern.

## Manual Setup Requirements

### Twilio Setup (Free Tier)

1. Create Twilio account at twilio.com (free trial provides ~$15 credit)
2. Get a Twilio phone number with SMS capability
3. Note Account SID, Auth Token, and phone number from Twilio Console
4. Free tier limits: ~$15 trial credit, SMS costs ~$0.0079/message (US), phone number ~$1.15/month

### Supabase Phone Auth Configuration

1. In Supabase Dashboard → Authentication → Providers → Phone
2. Enable Phone provider
3. Set SMS provider to "Twilio"
4. Enter Twilio Account SID, Auth Token, and Message Service SID (or Twilio phone number)
5. Set OTP expiry (default 60s is fine)
6. Free tier: Supabase doesn't charge extra for phone auth — cost is on Twilio side

### Supabase Migration (Manual)

1. In Supabase Dashboard → SQL Editor, run:
   ```sql
   ALTER TABLE user_profile DROP COLUMN IF EXISTS date_of_birth;
   ```

## Risks / Trade-offs

- **Twilio setup required** → Phone verification won't work without Twilio configured. Mitigation: phone number input works without verification; show graceful error if SMS fails. Document setup steps.
- **Twilio free tier credit exhaustion** → Trial credit runs out eventually. Mitigation: rate-limit OTP resends in UI (cooldown timer). Low volume during development.
- **localStorage skip flag can be cleared** → User clearing browser data re-triggers onboarding. Mitigation: acceptable — they fill in profile and it won't trigger again since profile is now complete.
- **Two data sources for profile** → `user_profile` table + `auth.users`. Mitigation: unified `FullUserProfile` type in store abstracts this. Components see one type.
- **Breaking change: `dateOfBirth` removal** → Existing profiles have this column. Mitigation: column drop is safe — no code references it after migration. Data loss is acceptable (field was never populated via UI).
