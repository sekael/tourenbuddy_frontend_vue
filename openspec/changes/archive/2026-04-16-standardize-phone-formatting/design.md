## Context

Phone numbers are written from four UI surfaces (manual contact form, contact detail edit, vCard import, Contact Picker) plus the user profile / phone verification path. Today each surface stores raw user input. The downstream `usePhoneActions` composable assumes a leading `+` or `00` to emit a WhatsApp link, which silently breaks for any input written in local national form. Duplicate detection in `contact-creation-dialog.vue` already uses (firstName, lastName) only, but tour partners will increasingly compare across imports where the phone is the only stable identifier; once we introduce phone-based dedup we must compare canonical values, not raw strings.

The app is Swiss-focused (Swisstopo map, German UI strings, Swiss tour planning). The vast majority of contacts will be Swiss phone numbers entered in national form (`079 123 45 67`). Numbers from foreign tour partners will arrive in international form. Both must round-trip cleanly to the same canonical representation.

There is no existing phone-parsing dependency in the project (`grep -r libphonenumber package.json` returned nothing). The only normalization helper today is `formatPhoneDisplay` in `contact.ts`, which handles only the `00` → `+` case.

## Goals / Non-Goals

**Goals:**

- All phone numbers persisted as a contact method or on the user profile reach the database in one canonical international format: a leading `+`, country code, and the remainder grouped per ITU-T E.123 spaces (e.g. `+41 79 012 34 56`).
- Live as-you-type formatting in every phone input so the user sees the final stored format while typing.
- Robust normalization at the persistence boundary so any unnormalized input that slips past the UI (imports, programmatic callers, future code) is still corrected before it hits Supabase.
- Reads of legacy non-canonical rows render the canonical form in the UI without requiring a database migration.

**Non-Goals:**

- Backfilling existing rows in the `contact_methods` table. Read-time normalization is sufficient.
- Country picker UI. The default region is configured globally as `CH` and inferred from the input itself when a `+` or `00` prefix is present.
- Server-side validation. Supabase / PostgREST receives whatever the client sends; client-side normalization is the source of truth for this change.
- Replacing the existing E.164 server-side requirement on `phone-verification`. The verification path keeps E.164 over the wire to Supabase Auth; we just normalize before sending.
- Stripping or rewriting the existing `tel:` URI logic. `usePhoneActions` already strips non-digits, so it will continue to work after numbers become canonical.

## Decisions

### Library choice: `libphonenumber-js` over `google-libphonenumber`

- `libphonenumber-js` is a from-scratch ESM port maintained by Catamphetamine, ~145 KB minified for the `min` metadata bundle, ~35 KB gzipped, fully tree-shakeable. It exposes `parsePhoneNumber`, `AsYouType`, and `isValidPhoneNumber` directly.
- `google-libphonenumber` is a closure-compiler port of the canonical Google Java/JS lib at ~530 KB; harder to tree-shake, awkward in modern Vite builds.
- We use the `min` metadata bundle (covers all countries, validates length only, not exact prefix). This is sufficient for a personal contacts feature and avoids the larger `max` metadata.
- Alternative considered: hand-rolled regex per country. Rejected — Switzerland alone has multiple mobile/landline patterns, and we must also accept foreign numbers.

### Default region: `CH`

- Hardcoded in `core/utils/phone-normalize.ts` as `const DEFAULT_REGION: CountryCode = 'CH'`.
- Rationale: Swiss-focused app, most users enter Swiss national numbers.
- Made overridable via an optional `defaultCountry` parameter on `normalizePhone(input, defaultCountry?)` so the user-profile path can pass a different default in the future without touching call sites.
- Alternative: derive from `navigator.language` or browser locale. Rejected as premature — adds complexity, can resolve to non-existent regions for our user base, and a misdetected default is harder to debug than a constant.

### Canonical storage format: `formatInternational()` (spaced) not E.164 (unspaced)

- libphonenumber-js's `formatInternational()` produces `+41 79 123 45 67`. `format('E.164')` produces `+41791234567`.
- User explicitly specified the spaced form in the request: "stored in international format with leading +, e.g. +41 79 012 34 56".
- All downstream consumers tolerate spaces:
  - `usePhoneActions.stripToDialable` already strips non-digits.
  - WhatsApp link builder already strips non-digits.
  - `getPrimaryPhone` returns the value verbatim (display only).
- The user-profile `phone-verification` path requires E.164 over the wire to Supabase Auth — we normalize first, then call `format('E.164')` only for the network call, while still storing the spaced form in `user_profiles.phone_number`.
- Trade-off: storing with spaces means the column value is not directly usable as a SQL key for exact-match queries (`WHERE phone = ?` won't match across different formattings). We accept this because the only equality we actually do today is duplicate detection inside the import flow, which we'll perform on the normalized canonical string anyway. If future server-side dedup is needed, a generated `phone_e164` column can be added.

### Where normalization runs: at write boundary in the store, not in the repository

- The contacts Pinia store actions (`addContact`, `addMethodToContact`, `updateMethodOnContact`) call the normalizer before invoking the repository. The repository stays a thin pass-through to PostgREST.
- Rationale: validation/normalization is presentation-layer business logic, not data-layer transport. Keeping it out of the repository preserves the existing pattern where repositories accept already-validated domain objects.
- We additionally normalize at parse-time in `use-vcard-import.ts` and `use-contact-picker.ts` so that the import-results UI shows the canonical number to the user before they confirm the import.
- The form-level normalization (`AsYouType` in inputs) is a UX layer; the store-level normalization is the safety net.

### Live formatting: `AsYouType` in a composable, not in each component

- A new `useAsYouTypePhone(rawRef, defaultCountry?)` composable wraps libphonenumber-js's `AsYouType` formatter. It returns a `formatted` `Ref<string>` and a `setRaw(value: string)` setter.
- Inputs bind to the formatted ref via `v-model` plus an `@input` handler that invokes the setter; this keeps cursor handling sane (we replace the input value only when it differs from the formatted value, avoiding cursor-jump on every keystroke).
- Alternative considered: a wrapper `<phone-input>` component. Rejected for now — only three input sites need it, the composable is ~30 lines, and a component would force restyling against the existing `.input` class system.

### Unparseable inputs

- `normalizePhone` returns `{ ok: true, value: '+41 …' }` on success and `{ ok: false, raw: <input> }` on failure (empty, gibberish, too-short).
- At the contacts store: failed normalization on a non-empty input throws a domain error surfaced via the existing error refs, blocking the save.
- At import paths: failed normalization keeps the raw value on the `VCardContact` / `PickedContact` and the import-results UI marks it with a "couldn't parse" hint, but still imports it (better than losing data; user can fix in the contact detail view).
- Empty / null phone is always valid (phone is optional everywhere it appears).

### Backwards compatibility for existing rows

- `formatPhoneDisplay(value)` in `contact.ts` is rewritten to call `normalizePhone(value)` and return the canonical form on success, falling back to the original string on failure.
- All read sites (`contact-detail-view.vue` method display, `contact-chip.vue`) already route phone through `formatPhoneDisplay` or pass it straight to `usePhoneActions`. Both continue to work; the rewrite simply makes the display more consistent.
- No SQL migration is required. Rows persisted before this change render normalized; rows updated after this change are stored normalized.

## Risks / Trade-offs

- **[Bundle size +35 KB gzipped] → Mitigation**: Use libphonenumber-js's `min` metadata bundle, import only the named functions actually used (`parsePhoneNumberFromString`, `AsYouType`, `isValidPhoneNumber`), and let Vite tree-shake. Document the dependency choice in `architecture.md` if accepted.
- **[Cursor jumping when AsYouType reformats mid-edit] → Mitigation**: Only call `input.value = formatted` when `formatted !== input.value`, and preserve the cursor position by computing the digit-offset before/after. Common pattern; covered in `useAsYouTypePhone` unit tests.
- **[Default region misclassification for foreign numbers entered without `+`] → Mitigation**: We require either a leading `+` / `00` or a valid Swiss national format. A French number like `06 12 34 56 78` typed without `+33` would be misinterpreted as Swiss `+41 6 12 34 56 78` and likely fail the libphonenumber validity check. The normalizer returns `ok: false` in that case and the user sees a "couldn't recognize this number" error, which is the right UX — they need to add the country code.
- **[Legacy rows in unusual formats may not normalize on read] → Mitigation**: `formatPhoneDisplay` falls back to the raw string on parse failure; the WhatsApp icon is already conditionally hidden when there is no country code, so the worst case is current behavior preserved.
- **[Phone verification path: stored with spaces, sent to Supabase Auth as E.164] → Mitigation**: Two distinct calls — `format('E.164')` for the `signInWithOtp` payload, `formatInternational()` for the `user_profiles.phone_number` column. Add a unit test that asserts both forms come from the same parse.
- **[Store-level normalization could throw and block valid empty inputs] → Mitigation**: Skip normalization entirely when the input is null, undefined, or an empty/whitespace string; only run on non-empty values.
