## MODIFIED Requirements

### Requirement: Phone number display on contact chip

In read-only tour info contexts, the contact chip SHALL NOT render inline phone action icons. Phone actions SHALL be exposed via the contact action menu opened by clicking the chip (see `contact-chip-actions`). In selection contexts (tour creation / edit form) the chip SHALL continue to render without any phone action icons. A shared helper `formatPhoneForDisplay` SHALL still be used wherever a phone number is rendered (e.g., inside the action menu rows).

#### Scenario: Contact chip in tour info hides inline icons

- **WHEN** a contact chip renders in tour info for a contact with a primary phone method
- **THEN** the chip SHALL NOT display inline call or WhatsApp icons
- **AND** clicking the chip SHALL open the contact action menu

#### Scenario: Contact chip in selection context hides action icons

- **WHEN** a contact chip renders in tour creation or tour edit selection mode
- **THEN** no phone action icons SHALL be displayed
- **AND** clicking the chip SHALL toggle selection (not open the action menu)

#### Scenario: Displayed phone numbers remain formatted

- **WHEN** a phone number is rendered anywhere the chip interaction surfaces (for example, inside an action menu row)
- **THEN** the displayed value SHALL be produced via `formatPhoneForDisplay`
