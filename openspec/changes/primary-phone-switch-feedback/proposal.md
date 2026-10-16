# Proposal

## Why

Issue #320: in the contact detail view, making another phone primary reorders the list instantly — the chosen number jumps to the top with no transition, so it is hard to see that anything happened. The current primary is only marked by a filled star, and in edit mode that star is still a button that invites "set as primary" on a number that already is.

## What Changes

- When a phone becomes primary, the phone rows glide to their new positions (slow, eased move) instead of jumping; no motion under `prefers-reduced-motion`.
- With more than one phone, the primary phone row is visibly highlighted (tinted, primary-coloured outline).
- The primary phone's star is inert in edit mode (no button, no "set as primary" tooltip); only non-primary phones offer the action.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `contact-methods`: adds presentation requirements for how the primary phone is shown and switched in the contact detail view.

## Impact

- `src/features/contacts/presentation/components/contact-detail-view.vue` (template + scoped CSS)
- `test/features/contacts/presentation/components/contact-detail-view.test.ts`
- No store, schema, DB or i18n changes (existing `primaryPhoneTooltip` copy reused).
