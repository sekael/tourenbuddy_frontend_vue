## Why

WhatsApp action on contact chip opens WhatsApp but shows "phone number shared via url is invalid" (issue #32). Swiss numbers stored as `079 123 45 67` become `https://wa.me/0791234567` — wa.me requires full E.164 digits, no leading zero. Feature is effectively broken for any contact stored without country code.

## What Changes

- `whatsAppLink` SHALL return a valid `https://wa.me/` URL only when the input phone is in international form (starts with `+` or `00`); otherwise return `null` so the WhatsApp button hides.
- Normalization strips `+` and converts a leading `00` to nothing (both are the international exit forms), then strips all non-digits. No leading-zero digits may remain.
- `telLink` behavior unchanged — local dialing still works for any input.
- Contact form input placeholder already hints `+41 79 123 45 67`; optionally reinforce guidance that WhatsApp requires international format.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `contact-phone`: Tighten `usePhoneActions` WhatsApp link generation — only produce a link for E.164-form input; return `null` otherwise.

## Impact

- Code: `src/features/contacts/presentation/composables/use-phone-actions.ts`, `test/features/contacts/presentation/composables/use-phone-actions.test.ts`.
- UI: `contact-chip.vue` already hides button when `whatsAppLink` is `null`; no template change required.
- No new dependency. No DB migration. No API change.
- Closes #32.
