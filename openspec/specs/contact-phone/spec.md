## ADDED Requirements

### Requirement: Phone action links

A `usePhoneActions` composable SHALL generate click-to-call and WhatsApp deep links from a phone number string. WhatsApp links are only produced when the input phone is in international form (starts with `+` or `00`), otherwise `whatsAppLink` SHALL be `null` so callers can hide the button.

#### Scenario: Generate tel link

- **WHEN** `usePhoneActions` is called with a phone number containing non-digit characters (e.g., `+41 79 123 45 67`)
- **THEN** `telLink` SHALL return a `tel:` URI with only digits and leading `+` preserved (e.g., `tel:+41791234567`)

#### Scenario: Generate WhatsApp link from E.164-plus format

- **WHEN** `usePhoneActions` is called with a phone number starting with `+` (e.g., `+41 79 123 45 67`)
- **THEN** `whatsAppLink` SHALL return `https://wa.me/<digits>` where `<digits>` are the digits after the `+`, with no leading zero (e.g., `https://wa.me/41791234567`)

#### Scenario: Generate WhatsApp link from 00-prefixed format

- **WHEN** `usePhoneActions` is called with a phone number starting with `00` (international exit prefix, e.g., `0041 79 123 45 67`)
- **THEN** `whatsAppLink` SHALL return `https://wa.me/<digits>` where `<digits>` are the digits after the leading `00` (e.g., `https://wa.me/41791234567`)

#### Scenario: WhatsApp link omitted when country code missing

- **WHEN** `usePhoneActions` is called with a phone number that does not start with `+` or `00` (e.g., `079 123 45 67`)
- **THEN** `whatsAppLink` SHALL return `null`
- **AND** `telLink` SHALL still return a valid `tel:` URI (e.g., `tel:0791234567`)

#### Scenario: No phone number

- **WHEN** `usePhoneActions` is called with `null`
- **THEN** both `telLink` and `whatsAppLink` SHALL return `null`

### Requirement: Phone number display on contact chip

When a contact has a primary phone method, the contact chip in tour info contexts SHALL display phone action icons (call + WhatsApp) that open the respective links. The WhatsApp icon SHALL be hidden when `whatsAppLink` is `null`.

#### Scenario: Contact chip with phone shows action icons

- **WHEN** a contact chip renders for a contact with a primary phone contact method in international format in a read-only context (e.g., tour info sheet)
- **THEN** the chip SHALL display tappable call and WhatsApp icons next to the contact name

#### Scenario: Contact chip with local phone hides WhatsApp icon

- **WHEN** a contact chip renders for a contact whose primary phone lacks a country code (e.g., `079 123 45 67`)
- **THEN** the chip SHALL display the call icon
- **AND** the WhatsApp icon SHALL NOT be displayed

#### Scenario: Contact chip without phone hides action icons

- **WHEN** a contact chip renders for a contact with no phone contact methods
- **THEN** no phone action icons SHALL be displayed

#### Scenario: Contact chip in selection context hides action icons

- **WHEN** a contact chip renders in tour creation (selection mode)
- **THEN** phone action icons SHALL NOT be displayed regardless of phone methods
