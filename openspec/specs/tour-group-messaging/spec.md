## ADDED Requirements

### Requirement: Group SMS row on tour info sheet

When a tour has more than one partner, the tour info sheet SHALL render a "Message all" row beneath the partner chips containing a single SMS action button. The row SHALL NOT render when the tour has zero or one partners. The row SHALL NOT include a call action or a WhatsApp action.

#### Scenario: Tour with multiple partners shows group row

- **WHEN** the tour info sheet renders for a tour with two or more partners
- **THEN** a group messaging row SHALL appear below the partner chips
- **AND** it SHALL contain an SMS action only

#### Scenario: Tour with one partner hides group row

- **WHEN** the tour info sheet renders for a tour with exactly one partner
- **THEN** the group messaging row SHALL NOT be rendered

#### Scenario: Tour with no partners hides group row

- **WHEN** the tour info sheet renders for a tour with no partners
- **THEN** the group messaging row SHALL NOT be rendered

### Requirement: Group SMS confirmation dialog

Tapping the group SMS action SHALL open a confirmation dialog listing:

- Included participants: partners whose primary phone method is a valid E.164 number (i.e. suitable as an `sms:` recipient).
- Excluded participants: partners without any SMS-capable phone, each shown with a one-line reason such as "no phone number".

The dialog SHALL expose a Cancel action and a Send action. The Send action SHALL be disabled when there are zero included participants. When only one partner is included, the dialog SHALL still be shown (no silent fallback to a 1:1 SMS).

#### Scenario: All partners have valid phones

- **WHEN** the user opens the group SMS dialog for a tour whose partners all have E.164 phones
- **THEN** the dialog SHALL list all partners under Included
- **AND** the Excluded section SHALL be absent or empty

#### Scenario: Some partners lack a phone

- **WHEN** the user opens the group SMS dialog and one partner has no phone methods
- **THEN** that partner SHALL appear under Excluded with reason "no phone number"
- **AND** other partners SHALL appear under Included

#### Scenario: No partners have a valid phone

- **WHEN** the user opens the group SMS dialog and no partner has an SMS-capable phone
- **THEN** the Send action SHALL be disabled
- **AND** a hint SHALL explain that no recipients are available

### Requirement: Group SMS launch target

Confirming the dialog SHALL navigate to `sms:<n1>,<n2>,…` where each `nₖ` is an included partner's primary phone in E.164 form, comma-separated, in the order listed in the Included section. The URI SHALL NOT include a message body. After launching, the dialog SHALL close.

#### Scenario: Send to two included partners

- **WHEN** the user confirms the dialog with two included partners whose E.164 numbers are `+41791234567` and `+41781112233`
- **THEN** the browser SHALL navigate to `sms:+41791234567,+41781112233`
- **AND** the dialog SHALL close
