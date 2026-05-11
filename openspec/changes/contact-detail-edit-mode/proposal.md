## Why

Contact detail view today is always-editable per-field: name, each contact method row, and an inline "add method" sub-form each have their own save buttons. When the inline `ConnectPrompt` is shown (verified-phone match), tapping "Send request" sends the friend request but ignores any pending edits in those fields. The contact stays in an editable state with unsaved input, contradicting the user expectation that the friend-request flow finalizes the contact. The detail view also diverges from tour details, which use an explicit view/edit toggle.

## What Changes

- Contact detail view defaults to view (read-only) mode, mirroring tour-info-sheet. An Edit button toggles edit mode.
- Edit mode aggregates name fields, every contact-method row, and the add-method sub-form into a single editable form with one Save and one Cancel. Per-row save buttons are removed.
- Save persists all dirty changes; failure keeps the view in edit mode and surfaces field-level errors. Cancel reverts pending values.
- `ConnectPrompt` gains an optional `beforeSend: () => Promise<void>` hook. When provided, Send Request awaits it before calling `sendRequest`. A thrown error aborts the send and surfaces the error in-place.
- Detail-view ConnectPrompt wires `beforeSend` to commit pending edits (no-op if not in edit mode). On success, the view returns to view mode reflecting the persisted data.
- Manual add-form ConnectPrompt wires `beforeSend` to submit the contact form first. Import-results ConnectPrompt passes a no-op (contacts already persisted) but flows through the same gate for consistency.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `contacts`: Contact detail view becomes view/edit mode with a single Save/Cancel covering all editable fields.
- `contact-account-linking`: Connect prompt's "Send request" action becomes gated on a caller-supplied pre-send hook; pending contact edits are committed before the request is sent.

## Impact

- `src/features/contacts/presentation/components/contact-detail-view.vue` — refactor to view/edit modes; remove per-row save buttons; single `saveAll`; expose imperative API via `defineExpose`.
- `src/features/friendships/presentation/components/connect-prompt.vue` — add optional `beforeSend` prop; abort + surface error on rejection.
- `src/features/contacts/presentation/components/contacts-list-sheet.vue` — wire detail-view ref → ConnectPrompt `beforeSend`; wire `ContactForm` programmatic submit → manual-add ConnectPrompt `beforeSend`.
- `src/features/contacts/presentation/components/contact-form.vue` — expose programmatic `submit()` via `defineExpose` so the connect-prompt gate can trigger validation + submit.
- `src/locales/en.json`, `src/locales/de-CH.json` — new keys: `contacts.detailView.editBtn`, `contacts.detailView.cancelBtn`, `contacts.detailView.saveBtn`, `contacts.detailView.saveFailed`.
- Tests under `test/features/contacts/` and `test/features/friendships/` — view/edit toggle, save-aborts-send on validation error, success path exits edit mode.
- No DB / RLS / migrations impact.
