## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/157-delete-verified-phone`
- [x] 1.2 Confirm `supabase start` local stack running

## 2. Database Migration

- [x] 2.1 `supabase migration new delete_own_phone` to create migration file under `supabase/migrations/`
- [x] 2.2 Implement `public.delete_own_phone()` SECURITY DEFINER function per design (clears `auth.users.phone`, `phone_confirmed_at`, `phone_change*`; deletes `auth.identities` row where `provider='phone'` for `auth.uid()`)
- [x] 2.3 `revoke all on function public.delete_own_phone() from public; grant execute to authenticated;`
- [x] 2.4 `supabase db reset` and verify: function exists, calling it as user A nulls phone fields and removes identity row
- [x] 2.5 Manual local check: after user A deletion, user B can verify the same E.164 number with no conflict
- [x] 2.6 Do NOT edit any existing migration file

## 3. Core Exception

- [x] 3.1 Add `src/core/exceptions/phone-already-registered-error.ts` exporting `PhoneAlreadyRegisteredError extends Error` (name set, default message key `user.phoneVerification.alreadyRegisteredError`)
- [x] 3.2 Re-export from `src/core/exceptions/index.ts`

## 4. Store: deletePhone + pre-check

- [x] 4.1 In `src/features/user/presentation/stores/user-profile-store.ts` add async `deletePhone()` that calls `supabase.rpc('delete_own_phone')`, surfaces errors via `error` ref, then calls `supabase.auth.refreshSession()` (or refetch user) so `authStore.currentUser` updates
- [x] 4.2 Modify `sendPhoneVerification` to pre-check uniqueness via `supabase.rpc('find_user_by_phone', { p_phone: e164 })`; throw `PhoneAlreadyRegisteredError` when returned id ≠ `authStore.currentUser?.id`
- [x] 4.3 Map Supabase `auth.updateUser` errors matching `/already|exists|registered|in use/i` to `PhoneAlreadyRegisteredError` (fallback for unverified callers)
- [x] 4.4 Expose `deletePhone` from store return

## 5. UI: Profile sheet

- [x] 5.1 In `src/features/user/presentation/components/user-profile-sheet.vue` add "Remove phone number" button inside edit form (only when `full.phoneNumber` truthy)
- [x] 5.2 On click: if `full.phoneVerified` is true, open confirmation `AdaptiveOverlay` with disclaimer copy; if false, call `userProfileStore.deletePhone()` directly
- [x] 5.3 Confirmation overlay buttons: Cancel + Remove (destructive style). Destructive button calls `userProfileStore.deletePhone()` and closes the overlay on success
- [x] 5.4 Render `PhoneAlreadyRegisteredError` inline under the phone input (translate via `t('user.phoneVerification.alreadyRegisteredError')`)
- [x] 5.5 After successful deletion, exit edit mode and refresh view-mode "Add phone" affordance

## 6. i18n

- [x] 6.1 Add to `src/locales/en.json` and `src/locales/de-CH.json`: `user.profile.removePhoneBtn`, `removePhoneConfirmTitle`, `removePhoneDisclaimer`, `removePhoneConfirmBtn`, `removePhoneCancelBtn`, `removePhoneFailed`
- [x] 6.2 Add `user.phoneVerification.alreadyRegisteredError` to both locales — message MUST include the literal string `feedback@tourenbuddy.ch`
- [x] 6.3 Verify no hard-coded user-facing strings introduced

## 7. Tests

- [x] 7.1 `test/features/user/presentation/stores/user-profile-store.spec.ts`: `deletePhone` propagates RPC error to `store.error`
- [x] 7.2 Store test: `sendPhoneVerification` pre-check returns other-user UUID → throws `PhoneAlreadyRegisteredError`, `auth.updateUser` not called
- [x] 7.3 Store test: pre-check returns own UUID → proceeds to `auth.updateUser`
- [x] 7.4 Store test: pre-check returns null + `auth.updateUser` returns "already registered" → throws `PhoneAlreadyRegisteredError`
- [x] 7.5 Store test: unrelated `auth.updateUser` error propagated unchanged (rate-limit message)
- [x] 7.6 Component test for `user-profile-sheet.vue`: verified phone → tapping remove opens confirmation overlay with disclaimer; unverified phone → no overlay, store action called directly

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` (zero warnings)
- [x] 8.2 `npm run type-check`
- [x] 8.3 `npm run test` — all passing
- [ ] 8.4 Prompt user to commit with conventional commit message: `feat(user): allow deleting phone number with reverify disclaimer (#157)` (body: rationale + migration note)
- [ ] 8.5 Prompt user to push branch and open PR against `main`; PR body references #157 and lists the new migration
- [ ] 8.6 Prompt user to run `supabase db push` only after PR review/merge
