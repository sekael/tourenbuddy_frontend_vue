## Why

Contact chips in the tour info sheet currently render call + WhatsApp action icons inline next to the chip, cluttering the partners row and exposing only primary-phone actions. Users have no path to jump to contact edit from a tour, and no way to message all partners at once for a tour. Issue #50 asks for chip-driven actions: click a chip to reveal full method list + edit, and group-message all partners at once.

## What Changes

- Contact chip in tour info (read-only) view becomes clickable; opens an action menu anchored to the chip (popover on desktop, bottom action sheet on mobile for native feel).
- **BREAKING (UI)**: Inline call + WhatsApp icons removed from the contact chip in tour info view. Actions only surface via the chip's action menu.
- Single-contact menu shows one row per **valid** phone method (E.164, `isValid=true`) with Call + WhatsApp actions. When a contact has multiple valid phone methods the user picks which one to call / WhatsApp — no silent primary auto-selection. The menu also shows an "Edit contact" entry that navigates to the existing contacts list edit flow. No new edit modal.
- Phone methods that are invalid or malformed (`isValid=false`, legacy non-E.164) SHALL be omitted from the menu entirely — no call, no SMS, no WhatsApp — because those values cannot be trusted to deep-link correctly.
- 1:1 messaging default is **WhatsApp** (`wa.me`). SMS is not offered as a 1:1 action; it surfaces only as the group fallback.
- Tapping a Call or WhatsApp action fires immediately — never a confirmation dialog.
- Multi-partner tours gain a group action row (separate from chips) with a single SMS icon. WhatsApp is _not_ used for the group action because `wa.me` does not support multi-recipient or group creation; SMS with comma-separated recipients is the only reliable cross-platform deep link. Tap opens a confirmation dialog listing included partners (those with a valid E.164 phone) and excluded contacts, then launches `sms:` with comma-separated E.164 numbers.
- Call action is never offered in the group context (1:1 only).
- Chip toggle-select behavior in `tour-form.vue` selector is unchanged; the chip gains a mode/variant prop so selection mode keeps toggling and view mode opens the action menu.

## Capabilities

### New Capabilities

- `contact-chip-actions`: chip click-to-open action menu, single-contact method actions, edit-contact navigation entry.
- `tour-group-messaging`: group SMS action on tours with multiple partners, including included/excluded participant confirmation dialog and `sms:` launch semantics.

### Modified Capabilities

- `contact-phone`: phone action icons no longer render inline on the contact chip in tour info; they are exposed via the chip action menu instead.
- `tours`: tour info sheet partners section renders chips without inline action icons and adds a group messaging row when >1 partner.

## Impact

- Code: `src/features/contacts/presentation/components/contact-chip.vue`, `src/features/tours/presentation/components/tour-info-sheet.vue`, `src/features/tours/presentation/components/tour-form.vue` (prop addition only), new action-menu + group-confirm components under `contacts/presentation/components/`, possible new composable for building contact method action lists.
- Specs: `contact-phone` delta (remove inline chip icons), `tours` delta (partners row updates), two new capability specs.
- Tests: `test/features/contacts/...` chip interaction tests, `test/features/tours/presentation/components/tour-info-sheet.test.ts` updates.
- No backend, schema, or Supabase changes. No new dependencies.
