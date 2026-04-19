## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/41-multi-phone-methods`

## 2. DB migration + Domain + Repository

- [x] 2.1 Add SQL migration creating Postgres function `set_primary_phone(p_contact_id uuid, p_method_id uuid) RETURNS SETOF contact_methods` (SECURITY INVOKER, single transaction, clears siblings then sets target, RAISE EXCEPTION if target row not updated)
- [x] 2.2 Add `setPrimaryPhone(contactId, methodId)` to `ContactMethodsRepository` interface
- [x] 2.3 Implement `setPrimaryPhone` in `ContactMethodsRepositoryImpl` via `supabase.rpc('set_primary_phone', { p_contact_id, p_method_id })`; return parsed rows
- [x] 2.4 Add `orderedPhoneMethods(contact)` helper in `src/features/contacts/core/utils/order-phone-methods.ts` (primary first, rest insertion order)
- [x] 2.5 Update `getPrimaryPhone` to prefer `isPrimary: true`, fall back to first phone by insertion order

## 3. Store — single-primary invariant

- [x] 3.1 Change `addContact` signature to accept `phones?: Array<{ value, label?, isPrimary }>` and drop single `phoneNumber` param
- [x] 3.2 Validate in `addContact`: if `phones.length > 1`, exactly one must have `isPrimary: true`; if `phones.length === 1`, force `isPrimary: true`; throw on violation
- [x] 3.3 In `addContact`, insert every phone via repo in order; primary entry with `is_primary = true`, rest false
- [x] 3.4 Update `addMethodToContact`: first phone auto-promotes to primary; adding with `isPrimary: true` calls `setPrimaryPhone` to flip
- [x] 3.5 Update `updateMethodOnContact`: toggling `isPrimary: true` calls `setPrimaryPhone`
- [x] 3.6 Update `removeMethodFromContact`: if removing current primary and other phones remain, call `setPrimaryPhone` on next phone
- [x] 3.7 On any `setPrimaryPhone` failure, do NOT mutate local `isPrimary` state; rethrow so UI can surface error and keep the previous primary highlighted
- [x] 3.8 Update local `contactMethods` from the RPC response rows (not optimistically pre-computed)

## 4. vCard parser

- [x] 4.1 Replace single-TEL regex with `matchAll` capturing every `TEL` block including params
- [x] 4.2 Add param parser: extract `TYPE=` values and `PREF=` parameter; classify PREF by `TYPE=PREF` (v3) or `PREF=` (v4)
- [x] 4.3 Derive label: `CELL` → "Mobile", `HOME` → "Home", `WORK` → "Work"; join unknown with `/`; `null` when no recognised type
- [x] 4.4 Per-entry normalization via `normalizePhone`; retain raw on failure
- [x] 4.5 Primary selection precedence: PREF marker (lowest PREF= wins) → first CELL → first HOME → first WORK → first TEL
- [x] 4.6 Change `VCardContact` type: replace `phoneNumber` with `phones: VCardPhone[]`; update all callers

## 5. Contact Picker

- [x] 5.1 Update `useContactPicker` to iterate every `tel` entry; normalize each; first entry `isPrimary: true`; `label: null`
- [x] 5.2 Update return type: `phones: PickedPhone[]` instead of `phoneNumber`

## 6. Import flow

- [x] 6.1 Update contact creation dialog to call `addContact` with full `phones` array for each imported contact
- [x] 6.2 Import-results row: show primary phone inline + `+N more` indicator when additional phones exist
- [x] 6.3 Keep "couldn't parse" indicator tied to primary phone's canonical-form check

## 7. Manual contact form

- [x] 7.1 Render dynamic list of phone rows (value + label input + primary radio) in `contact-form.vue`
- [x] 7.2 Add "Add phone" button that appends empty row; per-row remove button
- [x] 7.3 Default primary: first row selected; removing the selected primary resets to first remaining row
- [x] 7.4 Validation: block submit when >1 non-empty rows and no primary selected; show inline error
- [x] 7.5 Submit maps rows to `phones` array and calls `contactsStore.addContact`

## 8. Contact detail view

- [x] 8.1 Render every phone method with a primary radio bound to `isPrimary`
- [x] 8.2 Selecting a non-primary radio calls store action that invokes `setPrimaryPhone`
- [x] 8.3 Add phone in detail view: default `isPrimary: false` when a primary exists, `true` when none
- [x] 8.4 Remove phone: if removing current primary, auto-promote next phone
- [x] 8.5 Order phone methods via `orderedPhoneMethods` so primary renders first

## 9. Downstream UI + star icon

- [x] 9.1 `ContactChip` reads `getPrimaryPhone` (already) — verify tel/WhatsApp links use primary
- [x] 9.2 `contacts-list-sheet` subtitle uses `getPrimaryPhone` (already) — verify it updates when primary flips
- [x] 9.3 Add filled Material Symbols `star` icon next to primary phone in: list subtitle (when phones > 1), contact detail phone row, import-results row, contact chip phone actions
- [x] 9.4 Build primary-selector control using `star` glyph (filled = selected, outlined = not) shared between contact form and contact detail view
- [x] 9.5 On `setPrimaryPhone` rejection, show error snackbar and ensure star highlight snaps back to previous primary

## 10. Tests

- [x] 10.1 Update `parseVCardText` tests: multi-TEL block, PREF v3, PREF v4, mixed labels, normalization per entry, CELL > HOME > WORK fallback, no-type fallback to first
- [x] 10.2 Update `use-contact-picker` tests: multi-tel contact returns all phones with first primary
- [x] 10.3 Update contacts store tests: add-contact with multiple phones, missing primary throws, primary flip via `setPrimaryPhone`, remove-primary promotes next, RPC rejection leaves previous primary intact
- [x] 10.4 Update `getPrimaryPhone` tests: explicit primary wins over first phone
- [x] 10.5 Add `orderedPhoneMethods` unit tests
- [x] 10.6 Update `contact-form` component tests: add/remove rows, primary validation
- [x] 10.7 Update `contact-detail-view` component tests: primary toggle, add/remove invariant, rollback on RPC failure
- [x] 10.8 Add DB-level pgTAP-or-SQL test (or integration test against local Supabase) for `set_primary_phone`: flip works, invalid id rolls back, wrong contact rolls back

## 11. Finalize

- [x] 11.1 Run `npm run lint` and `npm run format`; fix any reported issues
- [x] 11.2 Run `npm run type-check` and `npm run test`; fix failures
- [ ] 11.3 Prompt user to commit with message: `feat(contacts): support multiple phone methods per contact with enforced primary`
- [ ] 11.4 Prompt user to push branch and open PR referencing #41
