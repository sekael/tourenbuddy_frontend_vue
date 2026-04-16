## Why

Phone numbers enter the app from three sources (manual entry in contact form, contact detail edit, vCard file import, native Contact Picker API) and from a fourth path (user profile + verification). Each path stores the raw user input verbatim. As a result the same logical number can be persisted as `079 123 45 67`, `+41 79 123 45 67`, `0041791234567`, or `+41791234567`, which breaks downstream consumers: `usePhoneActions` only emits a WhatsApp link when the input already happens to start with `+` or `00`, duplicate detection across imports cannot match equivalent numbers, and the UI shows inconsistent formatting between contacts. Standardizing on a single canonical international format at write time fixes all of these in one place.

## What Changes

- Add a shared phone normalization utility (`core/utils/phone-normalize.ts`) backed by `libphonenumber-js` that parses any user-entered phone string against a configurable default country (default: `CH`) and returns the canonical international form (e.g. `+41 79 012 34 56`).
- Add a shared `useAsYouTypePhone` composable that wraps libphonenumber-js's `AsYouType` formatter so any phone input can render live international formatting on every keystroke.
- Wire live formatting into the manual phone inputs in `contact-form.vue` and `contact-detail-view.vue` (both the per-method edit row and the "Add method" row when type is phone).
- Normalize phone values before persistence in `contacts-store` actions (`addContact`, `addMethodToContact`, `updateMethodOnContact`) so all writes through the contacts feature are canonical regardless of caller.
- Normalize phone values during contact import (`use-vcard-import.ts`, `use-contact-picker.ts`) before they reach the contact store; unparseable values are kept verbatim so no data is lost but flagged to the user.
- Replace the ad-hoc `formatPhoneDisplay` helper with a call to the new normalizer so legacy non-canonical rows already in the database render consistently on read.
- Reuse the same normalizer for the user profile phone path (`onboarding-page.vue`, `user-profile-sheet.vue`) so verification is initiated against the canonical form, but keep the existing E.164 server-side requirement.
- Add unit tests covering Swiss, international, trunk-prefix, malformed, and empty inputs across all entry points.

## Capabilities

### New Capabilities

- `phone-formatting`: Defines the canonical phone storage format, the normalization contract, and the live as-you-type formatting contract used by every phone input in the app.

### Modified Capabilities

- `contact-device-import`: Imported phone numbers from vCard and Contact Picker SHALL be normalized to canonical international format before being passed to contact creation; unparseable values surface in the import result.

The `contact-methods` and `contact-phone` capabilities are intentionally **not** modified. The repository contract (insert/delete) and the `usePhoneActions` composable contract (tel/wa.me link generation from any input) are unchanged. The new normalization rule applies upstream of those layers and is captured under the new `phone-formatting` capability.

## Impact

- **New runtime dependency**: `libphonenumber-js` (~145 KB min, ~35 KB gzipped using the `min` metadata bundle; the `mobile` metadata bundle would be smaller if needed). Tree-shakeable.
- **Code touched**:
  - `src/core/utils/phone-normalize.ts` (new)
  - `src/core/composables/use-as-you-type-phone.ts` (new)
  - `src/features/contacts/domain/entities/contact.ts` (`formatPhoneDisplay` rewrite)
  - `src/features/contacts/presentation/stores/contacts-store.ts` (normalize on write)
  - `src/features/contacts/presentation/components/contact-form.vue`
  - `src/features/contacts/presentation/components/contact-detail-view.vue`
  - `src/features/contacts/presentation/composables/use-vcard-import.ts`
  - `src/features/contacts/presentation/composables/use-contact-picker.ts`
  - `src/features/user/presentation/pages/onboarding-page.vue` (use normalizer for the E.164 check + format on submit)
  - `src/features/user/presentation/components/user-profile-sheet.vue` (same)
- **Database**: No schema change. Existing rows are not migrated; they render correctly because reads go through the normalizer. A future opportunistic migration could rewrite legacy rows on next edit, but is out of scope for this change.
- **No breaking change** for end users — all previously valid inputs continue to be accepted, and stored values become more useful (WhatsApp button now appears for numbers that previously lacked a country code if the default region resolves them).
