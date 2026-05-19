## Context

Phone numbers are stored on `auth.users` (managed by Supabase Auth). The supabase-js client cannot set `phone` to `NULL` via `auth.updateUser`; that field accepts only non-empty E.164 strings. A second wrinkle: even after clearing `auth.users.phone`, the `auth.identities` row with `provider='phone'` and a `provider_id` equal to the old number remains and blocks another user from verifying the same number (Supabase enforces uniqueness on the identity provider_id).

Conflict messaging today: `sendPhoneVerification` in `user-profile-store.ts` calls `supabase.auth.updateUser({ phone })` directly and surfaces the raw Supabase error string to the UI when another user already owns the number.

The existing RPC `find_user_by_phone` (baseline migration) already returns the owning user id for a given E.164 string, gated on caller being phone-verified — usable for client-side pre-check when the caller is already verified. Pre-check from an unverified caller is not possible via this RPC; for that case we accept the Supabase auth error and translate it.

## Goals / Non-Goals

**Goals:**
- Allow user to delete their phone number from the profile UI (verified or unverified).
- Free the number for other users to verify by removing both `auth.users.phone`/`phone_confirmed_at` and the `auth.identities` phone row.
- Show clear disclaimer only when the deleted number was verified.
- Replace raw Supabase "already exists" error with a localized, actionable message pointing at `feedback@tourenbuddy.ch`.
- Keep blast radius small: one new SECURITY DEFINER RPC, scoped to `auth.uid()`.

**Non-Goals:**
- Admin override / merging accounts.
- Self-serve "transfer phone to another account" flow (user must contact feedback).
- Phone deletion via the onboarding flow (only profile edit).
- Server-side conflict pre-check for unverified callers (relies on Supabase auth error fallback).

## Decisions

### Decision 1: SECURITY DEFINER RPC `delete_own_phone()`

Add a new migration `<ts>_delete_own_phone.sql` defining:

```sql
create or replace function public.delete_own_phone()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update auth.users
     set phone = null,
         phone_confirmed_at = null,
         phone_change = '',
         phone_change_token = '',
         phone_change_sent_at = null
   where id = v_uid;

  delete from auth.identities
   where user_id = v_uid
     and provider = 'phone';
end;
$$;

revoke all on function public.delete_own_phone() from public;
grant execute on function public.delete_own_phone() to authenticated;
```

**Rationale:** supabase-js cannot null `phone`. SECURITY DEFINER is required to touch `auth.*`. Scoping to `auth.uid()` guarantees a user can only delete their own phone. Clearing `phone_change*` fields cancels any in-flight phone-change OTP. Deleting the `auth.identities` row releases the unique constraint that would otherwise block re-verification by another user.

**Alternatives considered:**
- Edge Function with service role key — heavier (deploy pipeline, secrets), no security benefit over a scoped DEFINER.
- Only nulling `auth.users.phone` without removing identity — would leave the number locked.

### Decision 2: Pre-check uniqueness with `find_user_by_phone`

Inside `sendPhoneVerification`, before calling `supabase.auth.updateUser({ phone })`, call `find_user_by_phone(p_phone)`. If the returned id is non-null and differs from the current `auth.uid()`, throw `PhoneAlreadyRegisteredError` (new exception class). UI maps this to the inline localized error referencing `feedback@tourenbuddy.ch`.

**Rationale:** Existing RPC already enforces caller-verification gating and returns the owner id. Pre-check is cheap and avoids relying on Supabase's English error string.

**Caveat:** `find_user_by_phone` requires caller to have `phone_confirmed_at`. If the caller is unverified (first-time add), pre-check returns NULL. In that path we fall back to mapping the Supabase `auth.updateUser` error (`"User already registered"` or similar) to the same `PhoneAlreadyRegisteredError`. Mapping is centralized in the store so UI handling stays uniform.

**Alternatives considered:**
- Add new `check_phone_available` RPC callable by unverified users — extra surface for enumeration attacks; rejected.
- Pure error-string parsing — brittle to Supabase upstream wording changes.

### Decision 3: UI placement — remove button inside profile edit form

The "Remove phone number" button lives inside the existing edit form (rendered in the same `AdaptiveOverlay` that already handles mobile bottom sheet vs desktop dialog automatically). Tapping it opens a confirmation overlay (also via `AdaptiveOverlay`) when the current phone is verified; for unverified, the deletion runs immediately and the form returns to its non-editing state.

**Rationale:** Matches user-supplied UX preference, reuses responsive overlay, keeps view mode clean.

### Decision 4: Error class

New `PhoneAlreadyRegisteredError extends Error` in `src/core/exceptions/` (file `phone-already-registered-error.ts`, re-exported from the barrel). Message defaults to the i18n key path — components translate at render time using `useI18n`.

### Decision 5: Locale keys

Add to both `en.json` and `de-CH.json`:

```
user.profile.removePhoneBtn
user.profile.removePhoneConfirmTitle
user.profile.removePhoneDisclaimer   (only shown when verified)
user.profile.removePhoneConfirmBtn
user.profile.removePhoneCancelBtn
user.profile.removePhoneFailed
user.phoneVerification.alreadyRegisteredError  (message includes feedback@tourenbuddy.ch)
```

## Risks / Trade-offs

- **Risk:** `delete_own_phone()` runs as `postgres`/definer and writes to `auth.*`. → **Mitigation:** strict `auth.uid()` scoping, `revoke all from public`, grant only to `authenticated`, tested locally via `supabase db reset` before push.
- **Risk:** Future Supabase Auth schema changes (column rename in `auth.users`) break the RPC silently. → **Mitigation:** integration test against local Supabase verifies the function deletes the identity row and the email-only login still works.
- **Risk:** Unverified caller cannot pre-check; relies on parsing `auth.updateUser` error wording. → **Mitigation:** matcher is permissive (regex on `already|exists|registered|in use`) and falls back to original error if unmatched, so users always see *some* error.
- **Trade-off:** Removing the `auth.identities` row means the user loses any phone-based login linkage. Acceptable — the app uses email OTP only, no phone login.
- **Risk:** Cached `authStore.currentUser` still shows old phone after deletion. → **Mitigation:** store action calls `supabase.auth.refreshSession()` (or refetches the user) after RPC succeeds so reactive `fullProfile` updates.

## Migration Plan

1. Create migration file via `supabase migration new delete_own_phone`.
2. `supabase db reset` locally — confirm function exists, identity row removed, re-verification by another user succeeds.
3. App-side changes + tests on the same branch.
4. `npm run test`, `npx eslint . --fix`, `npm run type-check`.
5. Prompt user to `supabase db push` (prod) on merge day.
6. Rollback: a follow-up migration dropping the function; client-side fall back to never-call (button absent if `RPC missing` returned). Not anticipated.
