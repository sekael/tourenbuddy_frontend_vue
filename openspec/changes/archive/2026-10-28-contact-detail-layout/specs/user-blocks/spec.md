## MODIFIED Requirements

### Requirement: Blocked-status badge on every contact reference

The system SHALL display a visual blocked-status indicator (red `block` material symbol) anywhere a blocked contact is referenced in the UI. The indicator MUST appear:
- next to the contact name in the contact list, in place of (or alongside) the friend badge, with a localized tooltip in desktop view,
- in the contact detail hero's status line, with the visible label "Blocked", in place of the friend status.

Membership is derived from `blockedPhones` (any contact phone normalized to E.164 that matches an entry) OR from `blockedUserIds` (when a `linkedFriendUserId` is known). The indicator MUST update reactively as the user-blocks-store state changes (block, unblock, realtime sync) — no remount or manual refresh.

#### Scenario: Blocked badge appears on contact list row
- **WHEN** the contact list renders a contact whose primary or any other phone matches a row in `blockedPhones`
- **THEN** a red `block` icon with the localized tooltip is rendered next to the contact name

#### Scenario: Blocked badge appears on contact detail
- **WHEN** the contact detail renders for a contact resolved to a blocked user
- **THEN** the red `block` icon with the label "Blocked" is rendered in the hero's status line

#### Scenario: Badge appears live after blocking
- **WHEN** the user successfully blocks a contact and remains on the same view
- **THEN** the badge appears on the contact's row / detail without a manual refresh

#### Scenario: Badge disappears live after unblocking
- **WHEN** the user successfully unblocks a contact and remains on the same view
- **THEN** the badge disappears without a manual refresh
