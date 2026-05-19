## Why

Users currently have no way to remove a phone number from their profile after adding it (verified or not). They cannot recover from typos, hand off a number to another account, or exercise basic data-control rights. The same phone can also collide with another existing verified account on re-entry, but today Supabase's raw auth error is surfaced unmodified.

Resolves GitHub issue #157.

## What Changes

- Add "Remove phone number" action in profile edit form (mobile bottom sheet, desktop dialog — existing `AdaptiveOverlay`).
- When current phone is verified, show confirmation dialog with disclaimer: re-adding the number will require reverification.
- When current phone is unverified, delete immediately without disclaimer.
- Deletion clears `auth.users.phone`, `auth.users.phone_confirmed_at`, and removes the `auth.identities` row with `provider='phone'` for the calling user — releasing the number for another user to verify.
- New SECURITY DEFINER RPC `delete_own_phone()` (Supabase JS `auth.updateUser` cannot null `phone`).
- Pre-check phone uniqueness via existing `find_user_by_phone` RPC before issuing OTP. If number belongs to another user, throw new `PhoneAlreadyRegisteredError` and show inline error with `feedback@tourenbuddy.ch` contact hint.
- New i18n keys (`en`, `de-CH`) for remove button, confirmation copy, disclaimer, and conflict error.

## Capabilities

### New Capabilities

_None — extends existing capabilities only._

### Modified Capabilities

- `user-profile`: adds "remove phone number" requirement (verified vs unverified flow, disclaimer behavior).
- `phone-verification`: adds uniqueness pre-check requirement and conflict error contract.

## Impact

- **Code**: `src/features/user/presentation/stores/user-profile-store.ts`, `src/features/user/presentation/components/user-profile-sheet.vue`, `src/core/exceptions/` (new `PhoneAlreadyRegisteredError`), `src/locales/en.json`, `src/locales/de-CH.json`.
- **Tests**: new files under `test/features/user/...` mirroring the store + component changes.
- **Database**: new migration `supabase/migrations/<ts>_delete_own_phone.sql` introducing the RPC and grants. Existing migrations untouched.
- **External**: no new dependencies. Continues to use Supabase Auth and existing `find_user_by_phone` RPC.
- **Risk**: SECURITY DEFINER function touches `auth.users` / `auth.identities` — scoped strictly to `auth.uid()`.
