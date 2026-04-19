## MODIFIED Requirements

### Requirement: Phone action links

A `usePhoneActions` composable SHALL generate click-to-call and WhatsApp deep links from a phone number string. Because all persisted phone values are E.164 (see `phone-formatting`), `usePhoneActions` SHALL produce both a `tel:` link and a `https://wa.me/<digits>` link whenever the input is non-null. When the input is `null`, both links SHALL be `null`. Legacy non-E.164 inputs (which may still appear for `isValid=false` rows) SHALL fall back to: `tel:` link with non-digits stripped (preserving leading `+` if present), `whatsAppLink = null`.

#### Scenario: Generate tel and WhatsApp links from E.164 input

- **WHEN** `usePhoneActions` is called with `'+41791234567'`
- **THEN** `telLink` SHALL be `'tel:+41791234567'`
- **AND** `whatsAppLink` SHALL be `'https://wa.me/41791234567'`

#### Scenario: Legacy non-E.164 input falls back

- **WHEN** `usePhoneActions` is called with a non-E.164 legacy value such as `'079 123 45 67'`
- **THEN** `telLink` SHALL be `'tel:0791234567'`
- **AND** `whatsAppLink` SHALL be `null`

#### Scenario: No phone number

- **WHEN** `usePhoneActions` is called with `null`
- **THEN** both `telLink` and `whatsAppLink` SHALL be `null`

### Requirement: Phone number display on contact chip

When a contact has a primary phone method, the contact chip in tour info contexts SHALL display phone action icons (call + WhatsApp) that open the respective links. The displayed phone number SHALL be formatted via `formatPhoneForDisplay`. The WhatsApp icon SHALL be hidden when `whatsAppLink` is `null` (only legacy `isValid=false` rows).

#### Scenario: Contact chip with E.164 phone shows both action icons

- **WHEN** a contact chip renders for a contact with a primary phone method (E.164) in a read-only context
- **THEN** the chip SHALL display tappable call and WhatsApp icons next to the contact name
- **AND** the displayed phone string SHALL be in spaced international form

#### Scenario: Contact chip with legacy invalid phone hides WhatsApp icon

- **WHEN** a contact chip renders for a contact whose primary phone method has `isValid = false`
- **THEN** the chip SHALL display the call icon
- **AND** the WhatsApp icon SHALL NOT be displayed

#### Scenario: Contact chip without phone hides action icons

- **WHEN** a contact chip renders for a contact with no phone contact methods
- **THEN** no phone action icons SHALL be displayed

#### Scenario: Contact chip in selection context hides action icons

- **WHEN** a contact chip renders in tour creation (selection mode)
- **THEN** phone action icons SHALL NOT be displayed regardless of phone methods
