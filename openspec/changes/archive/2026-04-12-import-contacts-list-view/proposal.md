## Why

After importing contacts from a file (or Contact Picker), the dialog still shows the manual entry form which is confusing — the user already imported contacts, they don't need to type one in. Replacing the manual form with a list of imported contacts gives clear feedback on what was just added.

## What Changes

- **Replace manual form after import**: When contacts are imported (via file or Contact Picker), the manual entry form and import buttons are replaced with a scrollable list showing all contacts that were just imported (name + phone if present)
- **Skipped contacts indicator**: Contacts skipped due to duplicates are shown in the list with a "skipped" badge
- **Back to manual entry**: A "Add another manually" link lets users switch back to the manual form if needed
- **Done button**: Replaces the submit button, closes the dialog

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `contacts`: Contact creation dialog gains post-import list view state

## Impact

- **Components**: `contact-creation-dialog.vue` — add reactive view state (`form` | `import-results`), import results list rendering
- **No new files**: All changes within existing component
