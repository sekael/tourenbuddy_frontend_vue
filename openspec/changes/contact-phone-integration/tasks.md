## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/62-contact-phone-integration`

## 2. ContactMethod Model & Schema

- [x] 2.1 Create `contact-method-schema.ts` in `src/features/contacts/data/models/` — define `contactMethodRowSchema` (snake_case: `id`, `contact_id`, `method_type`, `value`, `label`, `is_primary`) and `contactMethodSchema` (camelCase transform)
- [x] 2.2 Create `ContactMethod` type via `z.infer` in `src/features/contacts/domain/entities/contact-method.ts`
- [x] 2.3 Create `getPrimaryPhone(contact)` utility — returns primary phone value from contact's methods array, falls back to first phone method, returns `null` if none

## 3. Extend Contact Model

- [x] 3.1 Update `contactRowSchema` to include `contact_methods` array (parsed via `contactMethodRowSchema`), default to empty array
- [x] 3.2 Update `contactSchema` to include `contactMethods: ContactMethod[]`
- [x] 3.3 Verify `Contact` type auto-infers `contactMethods` field

## 4. ContactMethods Repository

- [x] 4.1 Create `ContactMethodsRepository` interface in `src/features/contacts/domain/repositories/` with `addMethod(contactId, method)` and `removeMethod(methodId)`
- [x] 4.2 Create `ContactMethodsRepositoryImpl` in `src/features/contacts/data/repositories/` — Supabase INSERT/DELETE on `contact_methods` table

## 5. Update Contacts Repository & Store

- [x] 5.1 Update `fetchContacts()` in repository impl to use `supabase.from('contacts').select('*, contact_methods(*)')` — parse joined result
- [x] 5.2 Update `createContact` — no change to contacts INSERT, still returns contact without methods
- [x] 5.3 Extend `addContact` store action to accept optional `phoneNumber` — after creating contact, call `contactMethodsRepository.addMethod()` with `{ methodType: 'phone', value, isPrimary: true }` if phone provided
- [x] 5.4 Update store tests for new contact methods integration

## 6. Phone Action Links

- [x] 6.1 Create `usePhoneActions(phoneNumber: MaybeRef<string | null>)` composable in `src/features/contacts/presentation/composables/` — returns computed `telLink` and `whatsAppLink`
- [x] 6.2 Write unit tests for `usePhoneActions` — digits-only stripping, `tel:` format, `wa.me` format, null handling

## 7. Contact Import — Shared Utilities

- [x] 7.1 Create `parseContactName(fullName: string)` utility — split into firstName/lastName, handle single/multi-part names
- [x] 7.2 Write unit tests for name parsing (single name, two-part, multi-part like "Max von Muster")

## 8. Contact Import — Contact Picker API (Android)

- [x] 8.1 Create `useContactPicker` composable in `src/features/contacts/presentation/composables/` — expose `isSupported` boolean and `pickContacts()` method
- [x] 8.2 Implement phone extraction from Contact Picker API result (first `tel` entry or null)

## 9. Contact Import — vCard File (iOS / Desktop / Universal)

- [x] 9.1 Create `useVCardImport` composable in `src/features/contacts/presentation/composables/` — expose `parseVCardFile(file: File)` method
- [x] 9.2 Implement vCard parser: split file into `BEGIN:VCARD`/`END:VCARD` blocks, extract `FN`/`N` (name) and `TEL` (phone) fields, handle vCard 3.0 and 4.0 formats
- [x] 9.3 Write unit tests for vCard parser — single contact, multi-contact file, structured `N` field, `FN` fallback, `TEL` with type params, missing phone, edge cases

## 10. UI Components

- [x] 10.1 Add phone number input field to `contact-creation-dialog.vue` (optional, tel input type)
- [x] 10.2 Add "Import from file" button (always visible) — opens file input with `accept=".vcf,.vcard"`, parses file via `useVCardImport`, bulk-creates contacts (with phone methods) via store, shows snackbar with count
- [x] 10.3 Add "Import from contacts" button (visible only when Contact Picker `isSupported`) — calls `pickContacts()`, bulk-creates contacts via store, shows snackbar with count
- [x] 10.4 Implement duplicate detection on import (both methods) — skip contacts matching existing firstName + lastName (case-insensitive), report skipped count in snackbar
- [x] 10.5 Update `contact-chip.vue` — add `showActions` prop (default false), use `getPrimaryPhone()` + `usePhoneActions` to render call + WhatsApp icon buttons when phone present and `showActions` true
- [x] 10.6 Update `tour-info-sheet.vue` to pass `showActions: true` to contact chips for tour partners

## 11. Finalize

- [x] 11.1 Run `npm run lint` and `npm run format` — fix any issues
- [x] 11.2 Run `npm run test` — all tests pass
- [x] 11.3 Prompt user to commit with message: `feat(contacts): add phone methods with call/WhatsApp links and device contact import (#62)`
- [x] 11.4 Prompt user to push branch and create PR
