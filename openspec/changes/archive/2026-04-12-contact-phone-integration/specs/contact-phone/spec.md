## ADDED Requirements

### Requirement: Phone action links

A `usePhoneActions` composable SHALL generate click-to-call and WhatsApp deep links from a phone number string.

#### Scenario: Generate tel link

- **WHEN** `usePhoneActions` is called with a phone number containing non-digit characters (e.g., `+41 79 123 45 67`)
- **THEN** `telLink` SHALL return a `tel:` URI with only digits and leading `+` preserved (e.g., `tel:+41791234567`)

#### Scenario: Generate WhatsApp link

- **WHEN** `usePhoneActions` is called with a phone number
- **THEN** `whatsAppLink` SHALL return a `https://wa.me/` URL with only digits (no `+`) (e.g., `https://wa.me/41791234567`)

#### Scenario: No phone number

- **WHEN** `usePhoneActions` is called with `null`
- **THEN** both `telLink` and `whatsAppLink` SHALL return `null`

### Requirement: Phone number display on contact chip

When a contact has a primary phone method, the contact chip in tour info contexts SHALL display phone action icons (call + WhatsApp) that open the respective links.

#### Scenario: Contact chip with phone shows action icons

- **WHEN** a contact chip renders for a contact with a primary phone contact method in a read-only context (e.g., tour info sheet)
- **THEN** the chip SHALL display tappable call and WhatsApp icons next to the contact name

#### Scenario: Contact chip without phone hides action icons

- **WHEN** a contact chip renders for a contact with no phone contact methods
- **THEN** no phone action icons SHALL be displayed

#### Scenario: Contact chip in selection context hides action icons

- **WHEN** a contact chip renders in tour creation (selection mode)
- **THEN** phone action icons SHALL NOT be displayed regardless of phone methods
