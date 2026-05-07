## Context

Today the active UI locale is held in `localStorage['tb.locale']` per device, plus a derived base code (`en` | `de`) is mirrored to Supabase `user_metadata.locale` for email templating. Result: a user who picks German on the laptop still sees English on the phone PWA. Issue #113 asks for a single user-scoped preference replicated across devices/platforms, also driving email language.

Current state:
- `src/core/i18n/persistence.ts` — localStorage read/write
- `src/features/i18n/presentation/stores/use-locale-store.ts` — `setLocale` writes localStorage + `auth.updateUser({ data: { locale } })`
- `user_profile` table has only `id`, `first_name`, `last_name`
- Auth bootstrap: `i18n` chooses locale at module init from localStorage → detect; profile loads later via `useUserProfileStore.loadProfile()`

## Goals / Non-Goals

**Goals:**
- Single source of truth for user UI locale lives in `user_profile.locale` (DB).
- Locale follows authenticated user across devices/platforms after sign-in.
- Email locale stays consistent with the persisted preference.
- No flash of wrong language on cold boot for returning users on the same device.

**Non-Goals:**
- Cross-device sync for unauthenticated visitors (still localStorage / browser-detected).
- Real-time push of locale change to other open sessions of the same user (next load picks it up; no Realtime subscription).
- Changing the supported locale set or adding new languages.
- Replacing `user_metadata.locale` for emails (still used; profile write is additive — Supabase Auth email templates read from `user_metadata`).

## Decisions

### D1. Store locale on `user_profile`, not a new table
Keep all per-user preferences in one row. Column: `locale text` nullable, with CHECK constraint enumerating supported codes (`en`, `de-CH`). Nullable so absence = "not yet set", letting us seed from device on first authenticated load without overwriting an existing intentional NULL.

Alternative considered: separate `user_preferences` table — rejected, premature for a single field.

### D2. Hydration order: localStorage first, profile overrides
Boot path:
1. `i18n` initializes synchronously from `readPersistedLocale() ?? detectLocale()` (unchanged) → no flash for returning users on same device.
2. After `loadProfile()` resolves and `profile.locale` is non-null, `useUserProfileStore` calls `useLocaleStore.setLocale(profile.locale)` if it differs from current.
3. If `profile.locale` is null on first authenticated load, store seeds it: `repository.upsertProfile({ ..., locale: currentActiveLocale })`. This is a one-shot migration per account.

Alternative considered: block app render until profile loads — rejected, hurts TTI; localStorage cache is a good-enough first paint.

### D3. Write-through on every change
`setLocale(code)` for authenticated users writes:
1. `i18n.global.locale.value = code`
2. `localStorage['tb.locale'] = code` (boot cache)
3. `document.documentElement.lang = code`
4. `repository.upsertProfile({ locale: code })` via `useUserProfileStore.updateProfile({ locale: code })`
5. `auth.updateUser({ data: { locale: toEmailLocale(code) } })` (unchanged, for email templates)

Steps 4 + 5 fire-and-forget with logged failures; UI doesn't block.

Alternative: drop `user_metadata.locale` and have email hook read from `user_profile`. Rejected — bigger blast radius (modify auth-email-hook capability); fold into a follow-up if desired.

### D4. Locale store imports user-profile store (allowed direction)
`features/i18n` already in `presentation/stores/`. To write through, the locale store imports `useUserProfileStore`. This crosses feature boundaries but only one direction (i18n → user-profile is acceptable since user-profile has no need for i18n internals; both rely on shared core). Add narrow function on user-profile store: `setLocale(code)` that calls `updateProfile({ locale: code })` so locale store doesn't reach into profile internals.

Alternative: subscribe the user-profile store to a locale-change event — adds plumbing without payoff for one field.

### D5. Sign-out clears `localStorage['tb.locale']`? No.
Spec previously required survival across sign-out. Keep that — convenient for returning users on a shared device. Profile hydration on next sign-in still wins.

## Risks / Trade-offs

- **[Stale boot cache after device-B change]** User changes locale on device A, opens device B which has stale localStorage from yesterday — sees old locale for ~one tick until `loadProfile` resolves and `setLocale` re-applies. → Acceptable; migration is a single render flash, scoped to the post-login navigation. Mitigation: trigger hydration as early as possible after auth state restoration.
- **[Race: setLocale during profile load]** User opens profile sheet and changes locale before `loadProfile` finishes. → Locale store writes succeed; profile-store `updateProfile` will still upsert because it requires `profile.value` non-null — gate write-through on `profile.value` being loaded; if not, queue or skip and rely on next change. Simplest: skip DB write when profile not yet loaded; subsequent change persists. Document this.
- **[Migration column on existing rows]** Existing rows get NULL → first authenticated load seeds from device localStorage. Acceptable seed.
- **[CHECK constraint coupling]** Adding a new supported locale requires a migration to extend the CHECK list. → Document in the migration; small price for data integrity.

## Migration Plan

1. Ship migration `<date>_user_profile_locale.sql` adding nullable column + CHECK.
2. Deploy frontend in same PR; on first authenticated load per user, seed value from active locale.
3. No data backfill script needed — lazy seed on user activity.
4. Rollback: drop column; frontend tolerates absence (schema change reverted in same PR rollback).

## Open Questions

- Should we eventually migrate emails to read from `user_profile.locale` instead of `user_metadata.locale`? Out of scope for this change, tracked separately if desired.
