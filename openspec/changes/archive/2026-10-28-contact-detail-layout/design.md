# Design

## Context

`contact-detail-view.vue` (≈1550 lines) renders view and edit mode from one template; view mode is
the edit form with text instead of inputs. The host `contacts-list-sheet.vue` shows it inside an
`AdaptiveOverlay` (bottom sheet on a phone, side drawer on desktop), puts the contact's name in
the overlay title and Edit into `#header-actions`, and always passes `headerless` — the view's own
header row (back + Edit) is never rendered in the app. On a phone, edit mode becomes a full-screen
page with Save in the top bar. The tour detail (`tour-info-sheet.vue`) is the reference: hero,
then facts, then Edit / Delete in the overlay `#footer`.

## Goals / Non-Goals

**Goals:**
- One place for every action, ordered by how often it is used: reach the person (hero) before
  managing the record (footer).
- The name once (title), the relationship status in words.
- Glove-sized targets for the field actions.

**Non-Goals:**
- Edit mode layout (form, phone/email editing, primary switch): unchanged.
- Tappable phone rows for secondary numbers; SMS or email actions.
- Block for linked non-friends (the spec allows it; the code offers Block to friends only — kept).

## Decisions

### D1 — Footer through the overlay slot, rendered by the host

The footer belongs to the overlay (`#footer` of BottomSheet / SideDrawer, which pins it and fades
the content under it). The detail view is that overlay's content and cannot fill the slot, so the
host renders a new `ContactDetailActions` there, in view mode only. The delete and block flows
(state, confirmations, warnings, errors) move into it: they never touch edit state. Edit emits
up; the host calls `detailRef.enterEditMode()` as the header button did.

*Alternatives:* a sticky row inside the detail content (no fade, a second footer pattern in the
app); keeping the flows in the detail view and driving them from the host through `defineExpose`
(state lives where it isn't rendered).

### D2 — Blocked status in one composable

The hero (status line, Tours) and the footer (Block) both need "is this contact blocked": a phone
in `blockedPhones`, or the linked friend in `blockedUserIds`. The existing computed moves into
`useContactBlocked(contact, linkedFriendUserId)` and both components call it.

### D3 — Quick actions

Call and WhatsApp use the first entry of `buildContactActions(contact)`, which is the primary
phone when it is valid E.164 (invalid and legacy numbers are already excluded). No valid phone →
neither is shown. Tours shows for a friend that is not blocked. Each is a labelled tile (icon
above a short label), equal width in one row, at least 56px tall; Call and WhatsApp are links
(`tel:`, `wa.me` in a new tab), Tours a button. The row is omitted when it would be empty.

### D4 — Footer row

One row of equal thirds, ordered Delete · Block · Edit (Edit at the trailing edge), 44px tall.
Delete and Block are `danger-outline`, Edit `secondary` with the tour footer's neutral tint.
Text labels only: with icons the three German buttons need 122 + 136 + 137px, more than the 328px
a 360px phone leaves (measured); without them 90 + 104 + 105px fit. Delete gets a short label
("Delete" / "Löschen"); the confirm button keeps "Delete contact". A confirmation replaces the
row in place (as the tour footer does); the block confirmation keeps its existing inline panel.

### D5 — Hero

The full name ("First Last") as a subtitle only when a display name is set that differs from it
(seed data stores "Jakob Tester" as both), and a status line: `group` + "Friend on TourenBuddy",
or `block` + "Blocked". No avatar: the title already names the contact and an initial adds
nothing there (the contact list keeps its initials, where they help scanning). With neither
subtitle nor status the line is omitted. The "Name" heading and the name rows go.

### D6 — Remove the in-view header

`headerless` is always set, so the view's header row, the `headerless` prop and the `back` emit
are dead code that also carries a second Edit. They are removed; tests enter edit mode through
the `mode` model.

### D7 — Overlay footers grow with their content

On desktop the contacts overlay is a `DialogWindow`, which had no footer: it gains one, pinned
below the scrolling body with the same fade as the sheet and drawer, hidden while collapsed. The
bottom sheet counted its footer in the fitted height but never observed it, so a confirmation
opening in the footer (Block with a report text: ≈400px) overflowed a sheet sized for the row; it
now observes the footer and refits (up to its cap), the content above scrolling under the fade.

## Risks / Trade-offs

- [Three labelled buttons on a 360px phone may not fit one row in German] → measured; text labels
  without icons in equal thirds fit (D4).
- [The block confirmation (with report text) is tall for a footer] → the footer grows and the
  content above scrolls; same trade-off as the tour delete confirmation. Checked in the walk.
- [Call / WhatsApp for a blocked contact] → kept: blocking is app-level; the phone contact stays a
  phone contact.
