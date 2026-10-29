## 1. Git Setup

- [x] 1.1 Create the branch `fix/contact-detail-layout` — stacked on `feat/351-362-tour-filters`, which introduces the friend's-tours action this change moves (rebase onto `main` once that branch merges)

## 2. Shared blocked status

- [x] 2.1 Move the detail view's `isContactBlocked` computed into `presentation/composables/use-contact-blocked.ts` (`useContactBlocked(contact, linkedFriendUserId)`), used by the view and the footer

## 3. Footer actions

- [x] 3.1 New `contact-detail-actions.vue`: row Delete · Block · Edit; delete flow (confirm, relationship warnings, error, remove friendship then contact, emit `deleted`) and block flow (inline `BlockConfirmDialog`, block + optional report) moved from the detail view; Edit emits `edit`
- [x] 3.2 Locales: short delete label (`contacts.detailView.deleteAction`) in `en.json` and `de-CH.json`
- [x] 3.3 `contacts-list-sheet.vue`: drop the header Edit; render `ContactDetailActions` in `#footer` while a contact is shown in view mode, with the tour footer's neutral tint

## 4. Detail view

- [x] 4.1 Hero (no avatar): full-name subtitle when a display name is set, friend / blocked status line; remove the "Name" heading and name rows from view mode
- [x] 4.2 Quick actions: Tours (friend, not blocked), Call and WhatsApp from `buildContactActions(contact)[0]`; equal-width labelled tiles ≥ 56px; omitted when empty; view mode only
- [x] 4.3 Locales: Call / WhatsApp labels, "Tours" label for `showToursBtn`
- [x] 4.4 View mode: no primary star for a single phone
- [x] 4.5 Remove the in-view header, the `headerless` prop and the `back` emit; remove the danger section

## 4b. Overlay footers

- [x] 4b.1 `DialogWindow`: optional `#footer` pinned below the scrolling body, content fading above it, hidden while collapsed
- [x] 4b.2 `BottomSheet`: observe the footer so a fit-content sheet refits when a confirmation opens there

## 5. Tests

- [x] 5.1 `contact-detail-actions.test.ts`: delete confirm / cancel / failure keeps contact, friendship warnings, block hidden when unlinked or blocked, report survives the unlink mid-block, order of the row
- [x] 5.2 `contact-detail-view.test.ts`: hero subtitle only with a display name, status line, quick actions (no valid phone, nothing to offer, hidden while editing), single phone has no star; tests enter edit mode through the exposed `enterEditMode` (the host footer's path)
- [x] 5.3 `contacts-list-sheet` tests: no Edit in the header, footer only in view mode
- [x] 5.4 `bottom-sheet` (grows with its footer) and `dialog-window` (footer slot) tests

## 6. Verify

- [x] 6.1 Headless walk at 360px in `de-CH` and on desktop: friend, blocked, plain and display-name contacts; delete and block confirmations in the footer
- [x] 6.2 Persona UX review: baseline round on the current layout, then rounds on the new one until it passes

## 7. Finalize

- [x] 7.1 `npx eslint . --fix`, `npm run type-check`, `npm run check:locales`, `npm run test`
- [x] 7.2 Prompt the user to commit with a ready-to-copy conventional commit message
- [x] 7.3 Prompt the user to push and open a PR (based on `feat/351-362-tour-filters` until it merges), then archive the change with `openspec-archive`
