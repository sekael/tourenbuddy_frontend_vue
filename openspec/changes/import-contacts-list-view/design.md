## Context

The `contact-creation-dialog.vue` currently shows import buttons and manual entry form simultaneously. After importing contacts, only a text message ("N contacts imported") appears — the form stays visible, which is confusing.

## Goals / Non-Goals

**Goals:**

- After import, replace manual form with list of import results
- Show imported + skipped contacts clearly
- Allow user to return to manual entry if needed

**Non-Goals:**

- Editable import preview (edit before saving) — contacts save immediately on import as before
- Separate import dialog/page

## Decisions

### 1. Two-state view via reactive `viewState` ref

Add `viewState: ref<'form' | 'import-results'>('form')`. Conditionally render either the form (import buttons + manual fields) or the results list. Simple v-if toggle, no router involvement.

### 2. Track import results in local ref

`importResults: ref<ImportResult[]>([])` where `ImportResult = { firstName, lastName, phoneNumber, status: 'imported' | 'skipped' }`. Populated during import, rendered as list items. Cleared when switching back to form view.

### 3. Import still saves immediately

No change to save behavior — contacts are created in the store during import as before. The list view is purely a results display, not a preview/confirm flow.

## Risks / Trade-offs

- **No undo for imported contacts** → Acceptable for now. Edit/delete contact features are separate backlog items.
