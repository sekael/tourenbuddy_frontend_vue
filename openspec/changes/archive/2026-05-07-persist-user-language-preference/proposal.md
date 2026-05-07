## Why

Issue #113: language choice today persists only in `localStorage['tb.locale']` per device. Users who switch devices (laptop → phone PWA) get inconsistent UI language. Auth emails follow `user_metadata.locale` which only updates from the most recently active device, decoupling email language from the user's actual profile preference. We need one cross-device source of truth tied to the user.

## What Changes

- **BREAKING (spec-level):** Drop per-device UI locale isolation for authenticated users. UI locale becomes a user-scoped preference synced across devices.
- Add `locale` column to `user_profile` table (Supabase migration), nullable, constrained to supported codes.
- Extend `userProfileSchema` and `UserProfile` entity with `locale: SupportedLocaleCode | null`.
- `UserProfileRepository` reads/writes `locale` through `upsertProfile`.
- On auth/profile load, hydrate `useLocaleStore` from `profile.locale` if set; override the localStorage-derived boot locale.
- `useLocaleStore.setLocale` writes through to `user_profile.locale` for authenticated users (in addition to current `user_metadata.locale` for emails). For unauthenticated visitors, behavior unchanged (localStorage only).
- On first sign-in where `profile.locale` is null, seed it from current active locale so server becomes source of truth going forward.
- localStorage `tb.locale` retained only as pre-auth boot cache to prevent flash of wrong language; profile value wins once loaded.
- Email locale (`user_metadata.locale`) continues to mirror the chosen locale; profile write and metadata write happen together.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `i18n`: Replace per-device persistence requirement with profile-scoped persistence for authenticated users; keep localStorage as boot cache only.
- `user-profile`: Add `locale` field to profile schema/entity; profile language change writes through to `user_profile.locale`; profile load hydrates active locale.

## Impact

- **DB:** new migration adding `user_profile.locale text` column with CHECK constraint on supported codes; RLS unchanged (existing owner policies cover it).
- **Code:**
  - `src/features/user/data/models/user-profile-schema.ts` — add `locale`
  - `src/features/user/domain/entities/user-profile.ts` — type extends
  - `src/features/user/data/repositories/user-profile-repository-impl.ts` — read/write `locale`
  - `src/features/user/presentation/stores/user-profile-store.ts` — hydrate locale store on load
  - `src/features/i18n/presentation/stores/use-locale-store.ts` — write-through to profile
  - `src/core/i18n/index.ts` / `persistence.ts` — boot locale source-of-truth comment
- **Tests:** repo + store tests updated; new unit tests for hydrate/write-through.
- **No API key or external dep changes.**
