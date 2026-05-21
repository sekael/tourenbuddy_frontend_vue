## MODIFIED Requirements

### Requirement: Map action overlay with FABs

The map page SHALL display floating action buttons in the bottom-right speed dial for: base map style picker, user profile, contacts, and feedback. The previously top-level Tours and Add-tour FABs SHALL NOT be part of the speed dial — they are owned by the persistent bottom-center tour action bar. The speed-dial trigger SHALL be disabled while any overlay is active (`activeOverlay !== null`).

#### Scenario: Style picker button

- **WHEN** the user clicks the style picker entry in the speed-dial menu
- **THEN** a popup panel SHALL appear listing available map styles with a checkmark on the active one

#### Scenario: User profile button

- **WHEN** the user clicks the profile entry in the speed-dial menu
- **THEN** the user profile sheet SHALL open

#### Scenario: Contacts button

- **WHEN** the user clicks the contacts entry in the speed-dial menu
- **THEN** the contacts list sheet SHALL open

#### Scenario: Speed-dial does not expose Tours or Add tour

- **WHEN** the user opens the speed-dial menu
- **THEN** the menu SHALL NOT contain a Tours entry or an Add-tour entry

#### Scenario: Speed-dial trigger hidden during location picking

- **WHEN** `mapStore.isPickingLocation === true`
- **THEN** the speed-dial trigger and its menu SHALL be hidden (existing behaviour)

#### Scenario: Speed-dial trigger disabled when an overlay is open

- **WHEN** any overlay is active (`activeOverlay !== null`) and `mapStore.isPickingLocation === false`
- **THEN** the speed-dial trigger SHALL render in a disabled state
- **AND** clicking it SHALL NOT open the menu

## REMOVED Requirements

### Requirement: Map action overlay exposes a Tours FAB

**Reason**: The Tours action moves out of the speed dial into the new persistent bottom-center tour action bar (see capability `tour-action-bar`). Keeping it in both places would duplicate the affordance.

**Migration**: Consumers that previously listened for `MapActionOverlay`'s `open-tours` event SHALL listen to the `tours` event emitted by the new `TourActionBar` component. The page-level handler (`openOverlay('tours')`) is unchanged.

### Requirement: Map page registers the tours overlay

**Reason**: The requirement is preserved in behaviour but is no longer triggered from `MapActionOverlay`. The single-active-overlay policy for `'tours'` is now covered by the `tour-action-bar` capability's wiring scenarios plus the existing `responsive-overlay` spec. Listing it twice would create a contradiction at archive time.

**Migration**: No code migration — the `OverlayName` union still includes `'tours'`, `TourListSheet` still mounts inside the unified overlay container, and the single-active policy still applies. The trigger source moves from speed-dial to the new action bar.
