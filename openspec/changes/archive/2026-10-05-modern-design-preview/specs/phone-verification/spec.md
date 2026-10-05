## MODIFIED Requirements

### Requirement: Verified phone badge display

A blue checkmark icon SHALL be displayed next to phone numbers that are verified (`phone_confirmed_at` is not null on the auth user). The profile overview's identity card SHALL show the phone status and SHALL open the profile editor, where the number is added, changed, or verified.

#### Scenario: Verified phone shows badge

- **WHEN** the user's phone number is verified (auth user has `phone_confirmed_at` set)
- **THEN** a blue tick/checkmark icon SHALL be displayed next to the phone number in the profile view

#### Scenario: Unverified phone shows no badge

- **WHEN** the user has a phone number but it is not verified
- **THEN** no verification badge SHALL be displayed, a "Not verified" label SHALL be shown next to the number, and tapping the identity card SHALL open the editor from which the number is verified

#### Scenario: No phone number

- **WHEN** the user has no phone number set
- **THEN** an "Add phone number" prompt SHALL be displayed on the identity card in the profile view, and tapping the card SHALL open the editor
