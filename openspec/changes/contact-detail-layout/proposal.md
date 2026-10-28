## Why

The contact detail view reads like a disabled form: the name is shown four times (title plus First / Last / Display name rows), the actions are spread over three places with no hierarchy (Edit in the header, "Show tours" inside the name section, Block and Delete as full-width red pills at the bottom, the loudest thing on screen), and the one thing users open a partner's contact for in the field — calling them — is not offered at all. The tour detail already solved the same problem with a hero and a footer; the contact detail should follow it.

## What Changes

- The view opens with a hero (no avatar): the full name as a subtitle only when a display name is set (the header title already shows the resolved name), and the relationship status ("Friend on TourenBuddy" / "Blocked") as a labelled line instead of a bare icon next to a "Name" heading.
- A quick-action row under the hero: **Tours** (friend, not blocked), **Call** and **WhatsApp** to the primary valid phone. Large labelled targets, glove-sized.
- The First / Last / Display name rows and the "Name" heading are removed from view mode. Edit mode is unchanged.
- The phone list stays; in view mode a contact with a single phone shows no primary star.
- **Edit leaves the header.** Edit, Block and Delete move to the overlay footer as one row ordered Delete · Block · Edit, as the tour detail does. Delete and block confirmations open inline in the footer. The footer shows in view mode only.
- The detail view's own (unused) header row with back and Edit is removed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contacts`: the detail header is titled with the contact's name and holds no Edit; the friend's-tours action is a hero quick action; new requirements for the hero and for the footer actions.
- `design-system`: the "Contact detail has one header" scenario no longer lists Edit in the header.
- `user-blocks`: the blocked badge on the contact detail sits in the hero status line (there is no name section any more).
- `dialog-window`: an optional footer pinned below the scrolling content.
- `bottom-sheet`: a fit-content sheet refits when its footer grows.
- `contact-methods`: a single phone shows no primary star in view mode.

## Impact

- `src/features/contacts/presentation/components/contact-detail-view.vue` — hero and quick actions replace the name section; delete and block logic move out; dead in-view header removed.
- New `src/features/contacts/presentation/components/contact-detail-actions.vue` — the footer row with the delete and block flows.
- `src/features/contacts/presentation/components/contacts-list-sheet.vue` — renders the footer instead of the header Edit.
- `src/core/components/dialog-window.vue` — gains an optional footer (the desktop overlay); `src/core/components/bottom-sheet.vue` — refits when its footer grows.
- Reuses `buildContactActions` (call / WhatsApp links) from `contact-actions.ts`.
- Locales `en.json`, `de-CH.json`: call / WhatsApp labels, shorter tour and delete labels.
- Tests: `contact-detail-view*.test.ts`, `contacts-list-sheet*.test.ts`, `bottom-sheet.test.ts`, `dialog-window.test.ts`, new `contact-detail-actions.test.ts`.
- No data, store, or DB change.
