## Why

Contacts in TourenBuddy lack phone numbers, preventing quick communication with tour partners. Users must manually look up numbers elsewhere. Additionally, entering contact details by hand is tedious when the information already exists in the device's address book. Adding phone numbers with click-to-call/WhatsApp links and device contact import removes friction from tour partner coordination.

## What Changes

- **Integrate `contact_methods` table** — the Supabase schema already has a normalized `contact_methods` table with `method_type` enum (`phone`, `email`), `value`, `label`, and `is_primary` flag. Build Zod schemas, repository methods, and domain entities around this existing structure.
- **Phone action links** on contact display: tap-to-call (`tel:`) and WhatsApp deep link (`https://wa.me/`) for contacts with a primary phone method
- **Contact import from device** via two strategies:
  - **Contact Picker API** (Android Chrome/Edge) — native picker, select one or multiple contacts
  - **vCard file import** (iOS, desktop, all browsers) — user shares/exports contacts as `.vcf` file, picks via file input. Parses vCard format to extract name + phone
- **Manual phone entry** in contact creation dialog with international phone format support
- **Universal import availability** — at least one import method available on every platform. Contact Picker API preferred when available, vCard fallback always shown

## Capabilities

### New Capabilities

- `contact-methods`: Zod schemas, repository, and domain entities for the `contact_methods` table
- `contact-phone`: Phone action links (call + WhatsApp) using primary phone contact method
- `contact-device-import`: Import contacts from device address book via Contact Picker API and vCard file import

### Modified Capabilities

- `contacts`: Fetch contacts with their methods, updated creation dialog with phone field, updated repository

## Impact

- **Database**: No migration needed — `contacts` and `contact_methods` tables already exist in Supabase
- **Schema/types**: New `contactMethodRowSchema`/`contactMethodSchema` Zod schemas. `Contact` domain entity extended with `contactMethods` array
- **Repository**: New `ContactMethodsRepository` for CRUD on contact methods. `ContactsRepository` updated to fetch contacts with their methods
- **Components**: Contact creation dialog gains phone field + import buttons; contact chips/info display gain phone action links
- **Dependencies**: None new — Contact Picker API and File API are browser-native, `tel:` and `wa.me` links are standard URLs, vCard parsing is simple enough without a library
- **Browser support**: Contact Picker API (Android Chrome/Edge 80+) + vCard file import (all browsers) = universal coverage
