## Why

Contacts currently only support creation — no list view, no editing, no deletion. The map overlay button says "Add contact" and opens a creation dialog directly. Users cannot manage existing contacts after creation, making the feature incomplete. Issue #16 requires a full contacts management experience accessible from the map.

## What Changes

- Rename map action overlay button from "Add contact" to "Contacts" and change its behavior to open a contacts list view instead of the creation dialog
- New **contacts list sheet** (BottomSheet/SideDrawer) showing all saved contacts with search/filter
- Each contact in the list is tappable to view details and edit inline (name, phone, email)
- Delete contacts with confirmation
- "Add contact" action available inside the contacts list view (opens existing creation dialog or inline form)
- Extend `ContactsRepository` interface with `updateContact()` and `deleteContact()`
- Extend `ContactMethodsRepository` interface with `updateMethod()`
- Add corresponding Supabase implementations
- Extend Pinia contacts store with `updateContact()` and `deleteContact()` actions

## Capabilities

### New Capabilities

- `contacts-list`: Contacts list sheet accessible from map overlay — displays all contacts, search/filter, entry point for add/edit/delete
- `contact-edit`: Inline editing of contact details (name fields, contact methods) from contacts list
- `contact-delete`: Delete contacts with confirmation dialog, cascading method cleanup

### Modified Capabilities

## Impact

- **Components modified**: `map-action-overlay.vue` (button label + icon + event name), `map-page.vue` (swap creation dialog for contacts list sheet)
- **Domain layer**: `contacts-repository.ts` and `contact-methods-repository.ts` interfaces extended
- **Data layer**: `contacts-repository-impl.ts` and `contact-methods-repository-impl.ts` gain UPDATE/DELETE Supabase calls
- **Store**: `contacts-store.ts` gains update/delete actions
- **New components**: `contacts-list-sheet.vue`, `contact-detail-view.vue` (or inline edit within list)
- **No new dependencies** — uses existing BottomSheet/SideDrawer, Zod schemas, Supabase client
- **No breaking changes** — additive to existing contact creation flow
