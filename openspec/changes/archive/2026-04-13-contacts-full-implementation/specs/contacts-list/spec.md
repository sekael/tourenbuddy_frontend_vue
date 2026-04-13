## ADDED Requirements

### Requirement: Contacts list sheet accessible from map overlay

The system SHALL display a contacts list sheet (BottomSheet on mobile, SideDrawer on desktop) when the user taps the "Contacts" FAB button on the map action overlay. The sheet SHALL show all contacts belonging to the authenticated user, sorted alphabetically by first name.

#### Scenario: Open contacts list from map overlay

- **WHEN** user taps the "Contacts" FAB button on the map action overlay
- **THEN** a contacts list sheet opens showing all saved contacts sorted alphabetically by first name

#### Scenario: Empty contacts state

- **WHEN** user opens the contacts list and has no contacts
- **THEN** the sheet displays an empty state message (e.g., "No contacts yet") and a prominent "Add contact" action

#### Scenario: Close contacts list

- **WHEN** user taps the close button on the contacts list sheet OR taps the map background
- **THEN** the contacts list sheet closes and returns to the map view

### Requirement: Map overlay button shows "Contacts" instead of "Add contact"

The map action overlay SHALL display a "Contacts" button with the `contacts` Material Symbol icon, replacing the previous "Add contact" button with the `person_add` icon. The button SHALL emit an `openContacts` event instead of `openAddContact`.

#### Scenario: Button label and icon

- **WHEN** the map action overlay is visible
- **THEN** the contacts FAB shows the `contacts` icon and has title "Contacts"

### Requirement: Contact list item display

Each contact in the list SHALL display the resolved contact name (using existing `resolveContactName()` logic) and the primary phone number if available. Each row SHALL be tappable to navigate to the contact detail/edit view within the sheet.

#### Scenario: Contact with phone number

- **WHEN** a contact has a primary phone method
- **THEN** the list item shows the contact name and the primary phone number below it

#### Scenario: Contact without contact methods

- **WHEN** a contact has no contact methods (name only)
- **THEN** the list item shows the contact name with no secondary text

#### Scenario: Tap contact to open detail

- **WHEN** user taps a contact row in the list
- **THEN** the sheet navigates to the detail/edit view for that contact

### Requirement: Add contact entry point from contacts list

The contacts list view SHALL include an "Add contact" action that opens the contact creation flow. This preserves existing import flows (vCard file, Contact Picker API) and manual form entry.

#### Scenario: Add contact from list view

- **WHEN** user taps the "Add contact" action in the contacts list
- **THEN** the sheet navigates to the contact creation view with import options and manual form

#### Scenario: Return to list after adding contact

- **WHEN** user completes adding a contact (manual or import)
- **THEN** the sheet returns to the contacts list with the new contact visible in the sorted list
