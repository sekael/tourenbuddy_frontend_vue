## MODIFIED Requirements

### Requirement: Contact detail header is titled and pinned

The contact detail view header — back control, title, close — SHALL be titled with the contact's
resolved name (the display name, else first and last name). It SHALL hold no Edit action: Edit
sits in the detail footer.

The header row SHALL remain pinned to the top of the overlay while the detail content below it is
scrolled, and SHALL occlude the content passing underneath it. It SHALL move with the surface
itself — dragging the bottom sheet up or down on mobile moves the header with the sheet.

#### Scenario: Title reflects read mode
- **WHEN** a contact is opened from the contacts list
- **THEN** the header title reads the contact's resolved name
- **AND** the header holds back and close only, no Edit

#### Scenario: Header stays put while content scrolls
- **WHEN** the user scrolls the detail content past the header's resting position
- **THEN** the back control, title, and close remain visible at the top
- **AND** the content scrolling past SHALL NOT show through the header

#### Scenario: Header travels with a dragged sheet
- **WHEN** the bottom sheet holding the detail view is dragged to another snap point
- **THEN** the header moves with the sheet rather than staying fixed to the viewport

### Requirement: A friend's tours from the contact detail

The detail view of a contact linked to an accepted friend, and not blocked, SHALL offer a "Tours" quick action in its hero, marked with the route icon (a path between two points) — not a location pin, which reads as a place. It SHALL open the tour list on the Friends tab with the search cleared and only the recorded-by filter set, to that friend. Other contacts SHALL NOT offer the action.

#### Scenario: Opening a friend's tours

- **WHEN** the user opens a friend's contact detail and activates "Tours"
- **THEN** the contacts overlay SHALL be replaced by the tour list on the Friends tab
- **AND** the list SHALL show only tours that friend recorded, with the recorded-by filter holding that friend and the filters badge showing 1

#### Scenario: Earlier list state does not leak in

- **WHEN** the Friends tab had a search query or other filters before
- **THEN** opening a friend's tours from the contact detail SHALL clear them first

#### Scenario: Not offered for other contacts

- **WHEN** the contact is not linked to a friend, or is blocked
- **THEN** the "Tours" action SHALL NOT be shown

#### Scenario: Not offered while editing

- **WHEN** the contact detail is in edit mode
- **THEN** the "Tours" action SHALL NOT be shown

#### Scenario: Action reads as tours

- **WHEN** the "Tours" action is shown
- **THEN** it SHALL carry the route icon, not a location pin

## ADDED Requirements

### Requirement: Contact detail opens with a hero

In view mode the contact detail SHALL open with a hero: the full name as a subtitle only when a
display name is set that differs from it, the relationship status as an icon with a visible
label, and the contact's initial beside them (omitted when there is neither). View mode SHALL NOT
show a "Name" heading or First / Last / Display name rows; edit mode keeps its name fields.

#### Scenario: Name shown once
- **WHEN** a contact without a display name is opened
- **THEN** the name appears only as the header title, with no name rows and no subtitle

#### Scenario: Full name under a display name
- **WHEN** a contact with display name "Köbi", first name "Jakob" and last name "Tester" is opened
- **THEN** the header title reads "Köbi" and the hero subtitle reads "Jakob Tester"

#### Scenario: Friend status in words
- **WHEN** the contact is linked to an accepted friend and not blocked
- **THEN** the hero shows the friends icon with "Friend on TourenBuddy"

#### Scenario: No status for a plain contact
- **WHEN** the contact is neither a friend nor blocked, and has no differing display name
- **THEN** the hero shows no status line and no initial; the quick actions follow the header

### Requirement: Contact detail quick actions

Below the hero, view mode SHALL offer up to three labelled quick actions in one row of
equal-width targets at least 56px tall: Tours, Call and WhatsApp. Call and WhatsApp SHALL target
the first valid E.164 phone in primary-first order; the row SHALL be omitted when no action
applies.

#### Scenario: Calling from the hero
- **WHEN** the contact's primary phone is "+41790000002"
- **THEN** Call links to `tel:+41790000002` and WhatsApp opens `https://wa.me/41790000002` in a new tab

#### Scenario: No valid phone
- **WHEN** the contact has no valid E.164 phone
- **THEN** neither Call nor WhatsApp is shown

#### Scenario: Nothing to offer
- **WHEN** the contact has no valid phone and is not an unblocked friend
- **THEN** no quick-action row is rendered

#### Scenario: Hidden while editing
- **WHEN** the contact detail is in edit mode
- **THEN** no quick action is shown

### Requirement: Contact detail actions sit in the footer

In view mode the contact detail SHALL show Delete, Block and Edit as one row of equal-width,
text-labelled buttons at least 44px tall in the overlay's footer, in that order, on mobile and
desktop. Block SHALL follow the Block entry-point rules. A Delete or Block confirmation SHALL
replace the row in place. Edit mode SHALL show no such footer.

#### Scenario: Order and placement
- **WHEN** the detail of an unblocked friend is shown in view mode
- **THEN** the footer row reads Delete, Block, Edit from left to right, pinned below the scrolling content

#### Scenario: Edit from the footer
- **WHEN** the user activates Edit in the footer
- **THEN** the detail enters edit mode and the footer row is no longer shown

#### Scenario: Delete confirms in place
- **WHEN** the user activates Delete
- **THEN** the row is replaced by the delete confirmation with any friendship or pending-request warning
- **AND** Cancel restores the row

#### Scenario: One row on a phone
- **WHEN** a friend's detail is shown on a 360px-wide phone in `de-CH`
- **THEN** Delete, Block and Edit fit one row
