## ADDED Requirements

### Requirement: Friend tour owner attribution

A friend tour SHALL name its owner on both the tour list row and the tour detail sheet,
using the same resolved name in both places. The name SHALL be the name under which the
viewer has saved that user in their own contacts, matched by the user's registered phone
number — every friendship resolves to a contact by construction, so no second naming
source is consulted. Where no contact resolves, a generic "a friend" fallback SHALL be
shown so the owner line always has content; a contact whose name resolves to an empty
string SHALL be treated as not resolving. Owner attribution SHALL apply to friend tours
only — a tour the viewer owns SHALL NOT display an owner.

#### Scenario: Owner named by the viewer's contact

- **WHEN** the viewer opens a friend tour whose owner is saved in the viewer's contacts
  under a different name than the owner's profile name
- **THEN** both the list row and the detail sheet show the contact name, and the owner's
  profile name is not used as a source anywhere in the tour list or detail sheet

#### Scenario: Contact match by non-normalized phone

- **WHEN** the owner's contact stores their phone in local format rather than E.164
- **THEN** the contact still matches the owner's registered number and its name is shown

#### Scenario: No contact resolves

- **WHEN** the owner's registered phone number matches no contact — the broken-link state
  where a user changed their verified number
- **THEN** the generic "a friend" fallback is shown, and the owner line is still present

#### Scenario: List and detail agree

- **WHEN** the viewer opens a friend tour from the friends list
- **THEN** the owner name in the detail sheet is identical to the one on the row it was
  opened from

#### Scenario: Own tour has no owner line

- **WHEN** the viewer opens one of their own tours
- **THEN** no owner attribution is rendered on the row or in the detail sheet

#### Scenario: Partner named by contact where obtainable

- **WHEN** a friend tour lists a partner who is also a friend of the viewer and saved in
  their contacts
- **THEN** that partner is named by the contact name rather than by their profile name

#### Scenario: Partner the viewer is not connected to

- **WHEN** a friend tour lists a partner the viewer has no friendship or pending request
  with, so no phone number is obtainable for them
- **THEN** the server-resolved profile name is shown, and the partner is not reduced to a
  generic fallback

#### Scenario: Gated non-partner tour still names its owner

- **WHEN** the viewer opens a friend tour they are not a partner on, shown in gated form
- **THEN** the owner is named exactly as on a partner-visible tour — owner identity is not
  part of what the gating withholds

#### Scenario: Owner name is searchable

- **WHEN** the viewer types the owner's contact name into the search field on the Friends
  tab
- **THEN** that owner's tours match, resolved from the same source the row displays

### Requirement: Owner name is rendered once, never replaced

The owner name SHALL be written to the screen exactly once per tour, in its final resolved
form. The system SHALL NOT render the fallback and then replace it with a resolved name.
Until the phone lookup has settled — resolved **or** failed — and the viewer's contacts
have loaded at least once, the owner slot SHALL hold a placeholder occupying the same line
box as the final text, so that its replacement causes no reflow. The placeholder SHALL be
exposed as decorative to assistive technology. A lookup failure SHALL count as settled, so
the placeholder SHALL NOT persist indefinitely when the lookups cannot complete.

#### Scenario: No name flip during resolution

- **WHEN** the phone lookup settles before the viewer's contacts have finished loading
- **THEN** the fallback is never displayed; the slot holds the placeholder until the
  contacts are loaded, and then shows the contact name

#### Scenario: Contacts not yet loaded on a cold start

- **WHEN** the owner slot renders before the contacts collection has begun loading, so no
  contact could match yet
- **THEN** the slot holds the placeholder rather than treating the empty collection as a
  settled "no contact" result

#### Scenario: Placeholder does not shift the layout

- **WHEN** the placeholder is replaced by the resolved owner name
- **THEN** the row's height and the surrounding content's position are unchanged

#### Scenario: All lookups fail

- **WHEN** every lookup needed to resolve the owner rejects
- **THEN** the placeholder is replaced by the generic "a friend" fallback rather than
  remaining on screen

#### Scenario: Warm lookups skip the placeholder

- **WHEN** the owner's phone is already known locally and the contacts are loaded
- **THEN** the final name renders on first paint without a visible placeholder step

#### Scenario: Concurrent rows do not multiply lookups

- **WHEN** several friend-tour rows owned by the same user render at the same time, before
  any lookup for that user has returned
- **THEN** a single lookup is issued for that user and every row resolves from it
