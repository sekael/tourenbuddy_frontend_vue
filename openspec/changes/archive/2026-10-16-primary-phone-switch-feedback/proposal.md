# Proposal

## Why

Issue #320: in the contact detail view, making another phone primary reorders the list instantly — the chosen number jumps to the top with no transition, so it is hard to see that anything happened. The current primary is only marked by a filled star, and in edit mode that star is still a button that invites "set as primary" on a number that already is.

## What Changes

- Making a phone primary plays as three steps, starting on the tap: the old primary's highlight fades out, the rows glide to their new positions (slow, eased move) instead of jumping, then the new primary's highlight fades in. A failed save plays back to the old primary. Under `prefers-reduced-motion` the switch is instant.
- With more than one phone, the primary phone row is visibly but softly highlighted (light primary tint, faint primary hairline).
- The primary phone's star is inert in edit mode (no button, no "set as primary" tooltip); only non-primary phones offer the action.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `contact-methods`: adds presentation requirements for how the primary phone is shown and switched in the contact detail view.

## Impact

- `src/features/contacts/presentation/components/contact-detail-view.vue` (template, staging state, scoped CSS)
- New `src/features/contacts/presentation/composables/use-primary-switch-sequence.ts` (times the three steps)
- `src/features/contacts/core/utils/order-phone-methods.ts` (optional `primaryId` override; default behaviour unchanged for `contact-actions.ts`)
- Tests: `contact-detail-view.test.ts`, new `use-primary-switch-sequence.test.ts`
- No store, schema, DB or i18n changes (existing `primaryPhoneTooltip` copy reused).
