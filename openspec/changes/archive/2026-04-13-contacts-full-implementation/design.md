## Context

TourenBuddy has a contacts feature that currently only supports creation (manual entry, vCard import, Contact Picker API). There is no way to view all contacts, edit them after creation, or delete them. The map action overlay has an "Add contact" FAB that opens a creation-only dialog.

Current architecture follows clean architecture: domain interfaces → Supabase implementations → Pinia store → Vue components. The `ContactsRepository` interface only has `fetchContacts()` and `createContact()`. The `ContactMethodsRepository` only has `addMethod()` and `removeMethod()`.

UI patterns established: `BottomSheet` (mobile) / `SideDrawer` (desktop) via `useIsDesktop()`, glass-morphism FAB overlay, `Transition` wrappers in `map-page.vue`.

## Goals / Non-Goals

**Goals:**

- Full CRUD for contacts: list, create, edit, delete
- Contacts list view accessible via map overlay FAB (replacing "Add contact" button)
- Edit contact name fields and contact methods inline from contacts list
- Delete contacts with confirmation
- Maintain ability to add contacts with no contact info (name-only)
- Preserve existing import flows (vCard, Contact Picker)

**Non-Goals:**

- Contact groups or categories
- Contact search (defer unless trivial to add — small user contact lists expected)
- Offline sync for contacts (separate initiative)
- Contact sharing between users
- Contact photo/avatar support

## Decisions

### 1. Contacts list as a new BottomSheet/SideDrawer view

**Decision:** Create `contacts-list-sheet.vue` that uses existing `BottomSheet` component (renders as `SideDrawer` on desktop). Shows scrollable contact list with add button.

**Rationale:** Consistent with existing patterns (`FeedbackSheet`, `UserProfileSheet`, `TourInfoSheet`). No routing changes needed — stays as imperatively-shown modal from `map-page.vue`.

**Alternative considered:** Dedicated `/contacts` route page. Rejected because all other features use sheet/drawer pattern from map, and contacts are tightly coupled to map workflow.

### 2. Two-level navigation within contacts sheet

**Decision:** Contacts list sheet has internal navigation:

- **List view** (default): all contacts displayed as rows, "Add" button in header or footer
- **Detail/edit view**: tapping a contact shows editable detail form with name fields + contact methods + delete button
- **Add view**: reuses existing `contact-creation-dialog.vue` content (extract form into reusable component)

Back navigation within sheet via header back button. Sheet close returns to map.

**Rationale:** Keeps everything in one sheet without stacking multiple overlays. Matches mobile UX patterns (list → detail drill-down). Avoids complexity of multiple simultaneous sheets.

**Alternative considered:** Separate sheets for list and edit. Rejected — too many z-index layers, confusing UX with multiple sheets open.

### 3. Extend repository interfaces with update/delete

**Decision:** Add to `ContactsRepository`:

```typescript
updateContact: (id: string, data: Partial<Omit<Contact, 'id' | 'userId' | 'contactMethods'>>) =>
  Promise<Contact>
deleteContact: (id: string) => Promise<void>
```

Add to `ContactMethodsRepository`:

```typescript
updateMethod: (id: string, data: Partial<Omit<ContactMethod, 'id' | 'contactId'>>) =>
  Promise<ContactMethod>
```

**Rationale:** Follows existing interface pattern. Partial update allows changing individual fields. Supabase UPDATE/DELETE map directly.

### 4. Extract contact form into reusable component

**Decision:** Extract form fields from `contact-creation-dialog.vue` into `contact-form.vue`. Used by both creation flow and edit flow. Form component receives optional initial values for edit mode.

**Rationale:** Avoids duplicating form fields, validation, and styling. Creation dialog and edit view share identical fields (firstName, lastName, displayName, phone).

### 5. Delete with confirmation dialog

**Decision:** Use a simple inline confirmation within the detail view (e.g., "Delete" button → "Are you sure? Delete / Cancel" state) rather than a native `confirm()` or separate modal.

**Rationale:** Native `confirm()` looks inconsistent with app styling. Inline confirmation keeps user in context without another overlay layer.

### 6. Map overlay button change

**Decision:** Change FAB from `person_add` icon to `contacts` icon, title from "Add Contact" to "Contacts", emit name from `openAddContact` to `openContacts`.

**Rationale:** Direct requirement from issue #16. Button now opens list view rather than creation dialog.

### 7. Contact methods management in edit view

**Decision:** Edit view shows existing methods as editable rows. Each row: type (phone/email), value, label, delete button. "Add method" button at bottom. Methods saved individually via `ContactMethodsRepository`.

**Rationale:** Contact methods are independent records in Supabase (separate table). Individual CRUD avoids complex batch operations.

## Risks / Trade-offs

- **Sheet height on mobile with many contacts**: Long contact lists may feel cramped in BottomSheet (max 85vh). → Mitigation: scrollable list area with fixed header/footer. Virtual scrolling not needed given expected contact counts (< 100).

- **Optimistic UI vs. server-round-trip**: Could show changes immediately and rollback on error, or wait for server. → Decision: Wait for server response (simpler, Supabase latency acceptable for CRUD). Show loading states.

- **Extracting form component from existing dialog**: Requires careful refactoring to not break existing creation flow or import flow. → Mitigation: Keep import actions in creation dialog wrapper, only extract the manual form fields.

- **Event name change in map overlay**: `openAddContact` → `openContacts` is a breaking change within the component API. → Low risk since only `map-page.vue` consumes this event.
