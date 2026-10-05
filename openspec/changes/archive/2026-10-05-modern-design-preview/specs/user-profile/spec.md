## MODIFIED Requirements

### Requirement: Profile preferences UI for notifications
The profile SHALL offer a Notifications view, reached from the Notifications row of the profile overview (which summarizes the active channels), exposing channel toggles, per-type mute switches, and the all-channels-off disclaimer.

#### Scenario: Renders toggles
- **WHEN** the user opens the Notifications view from the profile overview
- **THEN** it renders push channel, email channel, and per-type toggles for each supported notification type

#### Scenario: All channels off
- **WHEN** push and email are both disabled
- **THEN** the Notifications view shows the disclaimer warning the user may miss friend requests and other important updates, and the overview's Notifications row reads "Off"

#### Scenario: Overview summarizes channels
- **WHEN** the profile overview is shown
- **THEN** the Notifications row states which channels are on ("Push and email", "Push only", "Email only", or "Off")
