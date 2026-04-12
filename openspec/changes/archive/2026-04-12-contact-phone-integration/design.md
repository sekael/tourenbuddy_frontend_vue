## Context

TourenBuddy contacts currently store `id`, `userId`, `firstName`, `lastName`, `displayName` in a `contacts` table. A normalized `contact_methods` table already exists in Supabase with columns: `id`, `contact_id`, `method_type` (enum: `phone`, `email`), `value`, `label`, `is_primary`. Unique constraints enforce one primary phone and one primary email per contact. The frontend currently has no code using `contact_methods`.

The app is a Vue 3 PWA deployed to Cloudflare Pages, backed by Supabase. Contact data flows through Zod schemas → repository → Pinia store → Vue components.

## Goals / Non-Goals

**Goals:**

- Build frontend integration for existing `contact_methods` table (phone type initially)
- Enable click-to-call (`tel:`) and WhatsApp (`wa.me`) links for contacts with phone methods
- Allow importing contacts from device address book on all platforms (Contact Picker API on Android, vCard file import on iOS/desktop)
- Keep full manual entry flow working on all platforms

**Non-Goals:**

- Email contact methods (table supports it, but out of scope for this change)
- Two-way sync with device contacts (one-time import only)
- SMS/messaging integration beyond URL deep links
- Contact editing/update UI (separate feature)
- Server-side phone number validation or E.164 normalization
- Contacts search/filtering UI

## Decisions

### 1. Use existing `contact_methods` table — no schema migration

The `contact_methods` table already has the right structure: `method_type` enum for phone/email, `value` for the number, `label` for optional description (e.g., "Mobile", "Work"), `is_primary` flag with unique index ensuring one primary per type per contact.

**Why not flatten phone onto contacts**: Normalized table is already there, supports multiple numbers per contact, distinguishes primary from secondary. Respects existing DB design.

### 2. Contact domain entity includes methods

`Contact` type gets a `contactMethods: ContactMethod[]` array. Fetched via Supabase join: `supabase.from('contacts').select('*, contact_methods(*)')`. Primary phone extracted via computed helper `getPrimaryPhone(contact)`.

**Why embed vs separate store**: Contact methods are tightly coupled to contacts — always loaded together, never queried independently. Embedding avoids N+1 and keeps store simple.

### 3. ContactMethod model and repository

New Zod schemas: `contactMethodRowSchema` (snake_case from Supabase) → `contactMethodSchema` (camelCase domain). New `ContactMethodsRepository` interface with `addMethod(contactId, method)` and `removeMethod(methodId)`.

**Why separate repository**: Contact methods have their own CRUD lifecycle — adding a phone after contact creation, removing a method. Keeps `ContactsRepository` focused on contact-level operations.

### 4. Phone number storage: free-text in `value` column

Store phone as-is in `contact_methods.value`. No format enforcement. Client-side link generation strips non-digit characters for `tel:` and `wa.me` URLs.

**Why no E.164**: Swiss users, simple app, avoiding libphonenumber dependency. Phone numbers from device contacts or manual entry have local formatting. Stripping non-digits for links is sufficient.

### 5. Two-tier contact import: Contact Picker API + vCard fallback

**Primary (Android)**: Use `navigator.contacts.select()` (Contact Picker API). Feature-detect with `'contacts' in navigator`. Best UX — native picker, multi-select, instant.

**Fallback (iOS, desktop, all browsers)**: vCard (`.vcf`) file import via `<input type="file" accept=".vcf,.vcard">`. User workflow on iOS: Contacts app → share contact(s) → save to Files → pick in TourenBuddy. On desktop: export contacts as `.vcf` from any contacts app, pick file.

**Why two strategies**: Contact Picker API not implemented in WebKit (iOS Safari, iOS Chrome — all use WebKit). vCard is universally supported — every contacts app can export `.vcf`. Together they cover all platforms.

**Import button logic**: Always show "Import from file" button (vCard). Additionally show "Import from contacts" when Contact Picker API available.

### 6. Phone action links as composable

Create `usePhoneActions(phoneNumber)` composable returning computed `telLink` and `whatsAppLink`. Used by any component displaying contact phone numbers.

**Why composable**: Reactive, DRY across contact chip, info sheet, future contact detail view.

### 7. Contact creation with phone: two-step write

1. `createContact()` — insert into `contacts` table, get back contact with ID
2. If phone provided, `addMethod(contactId, { methodType: 'phone', value: phone, isPrimary: true })` — insert into `contact_methods`

**Why not RPC**: Simple sequential inserts sufficient. Contact creation is low-frequency. If atomicity needed later, wrap in Supabase RPC.

### 8. Import flow

**Contact Picker flow (Android):**

1. User taps "Import from contacts"
2. Contact Picker API opens native picker (multi-select, `name` + `tel`)
3. For each selected contact: create TourenBuddy contact + phone method
4. Snackbar with count

**vCard file flow (all platforms):**

1. User taps "Import from file"
2. File input opens (`accept=".vcf,.vcard"`)
3. Parse `.vcf` — extract `FN`/`N` (name) and `TEL` (phone) per vCard block
4. For each parsed contact: create TourenBuddy contact + phone method
5. Snackbar with count

**vCard parsing**: Minimal parser — vCard 3.0/4.0 `BEGIN:VCARD`/`END:VCARD` blocks. Extract `FN`/`N` for name, first `TEL` for phone. No library needed.

## Risks / Trade-offs

- **Contact Picker API browser support narrow** → vCard file import as universal fallback. Contact Picker is progressive enhancement.
- **Two-step create not atomic** → Contact without method is valid state. Worst case: contact created but method insert fails — user can add phone later (once edit UI exists). Acceptable tradeoff.
- **No phone validation** → Phone numbers from device contacts typically valid. Manual garbage handled gracefully by `tel:` links.
- **Bulk import could be slow** → Sequential creates. Typical import 1-5 contacts, latency acceptable on Supabase free tier.
