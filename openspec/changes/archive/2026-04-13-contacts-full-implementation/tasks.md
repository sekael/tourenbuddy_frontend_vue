## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/16-contacts-full-implementation`

## 2. Domain Layer — Repository Interfaces

- [x] 2.1 Add `updateContact(id, data)` and `deleteContact(id)` to `ContactsRepository` interface in `src/features/contacts/domain/repositories/contacts-repository.ts`
- [x] 2.2 Add `updateMethod(id, data)` to `ContactMethodsRepository` interface in `src/features/contacts/domain/repositories/contact-methods-repository.ts`

## 3. Data Layer — Supabase Implementations

- [x] 3.1 Implement `updateContact()` in `contacts-repository-impl.ts` — Supabase UPDATE with joined contact_methods return
- [x] 3.2 Implement `deleteContact()` in `contacts-repository-impl.ts` — Supabase DELETE (cascade handles methods)
- [x] 3.3 Implement `updateMethod()` in `contact-methods-repository-impl.ts` — Supabase UPDATE returning updated method

## 4. Pinia Store — New Actions

- [x] 4.1 Add `updateContact(id, data)` action to contacts store — calls repository, updates local array, re-sorts
- [x] 4.2 Add `deleteContact(id)` action to contacts store — calls repository, removes from local array
- [x] 4.3 Add `addMethodToContact(contactId, method)` action — calls contact methods repository, updates local contact's methods array
- [x] 4.4 Add `updateMethodOnContact(contactId, methodId, data)` action — calls repository, updates local method
- [x] 4.5 Add `removeMethodFromContact(contactId, methodId)` action — calls repository, removes from local contact's methods array

## 5. Reusable Contact Form Component

- [x] 5.1 Extract manual form fields from `contact-creation-dialog.vue` into `contact-form.vue` — props for initial values (edit mode) and create mode, emits form data on submit
- [x] 5.2 Refactor `contact-creation-dialog.vue` to use `contact-form.vue` for its manual entry form (keep import actions in dialog wrapper)

## 6. Contacts List Sheet

- [x] 6.1 Create `contacts-list-sheet.vue` with internal view state (list | detail | add) using BottomSheet component
- [x] 6.2 Implement list view — scrollable contact rows showing resolved name + primary phone, empty state, "Add" action in header
- [x] 6.3 Implement navigation: tap contact → detail view, tap add → add view, back button returns to list

## 7. Contact Detail / Edit View

- [x] 7.1 Create `contact-detail-view.vue` — displays editable name fields (firstName required, lastName, displayName) with save action
- [x] 7.2 Add contact methods section — list of editable method rows (type, value, label) with remove action per row
- [x] 7.3 Add "Add method" action — type selector (phone/email) + value input + save
- [x] 7.4 Wire save actions to store's `updateContact`, `updateMethodOnContact`, `addMethodToContact`, `removeMethodFromContact`

## 8. Contact Delete

- [x] 8.1 Add delete button to contact detail view with inline confirmation (Delete → "Are you sure? Delete / Cancel")
- [x] 8.2 Wire confirmed delete to store's `deleteContact`, show loading state, return to list on success, show error on failure

## 9. Map Integration

- [x] 9.1 Update `map-action-overlay.vue` — change button icon to `contacts`, title to "Contacts", emit `openContacts` instead of `openAddContact`
- [x] 9.2 Update `map-page.vue` — replace `ContactCreationDialog` with `ContactsListSheet`, update event handler from `openAddContact` to `openContacts`, add to `handleMapBackgroundClick`

## 10. Tests

- [x] 10.1 Unit tests for new repository methods (updateContact, deleteContact, updateMethod) — mock Supabase client
- [x] 10.2 Unit tests for new contacts store actions (updateContact, deleteContact, method CRUD actions)
- [x] 10.3 Component tests for contacts list sheet — list rendering, empty state, navigation between views
- [x] 10.4 Component tests for contact detail view — edit fields, save, delete confirmation flow

## 11. Finalize

- [x] 11.1 Run `npm run lint` and `npm run format` — fix any issues
- [x] 11.2 Run `npm run type-check` — fix any type errors
- [x] 11.3 Run `npm run test` — all tests pass
- [x] 11.4 Prompt user to commit with message: `feat(contacts): add contacts list, edit, and delete (#16)`
- [x] 11.5 Prompt user to push branch and create PR
