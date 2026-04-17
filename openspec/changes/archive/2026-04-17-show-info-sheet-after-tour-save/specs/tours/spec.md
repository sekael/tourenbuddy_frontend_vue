## MODIFIED Requirements

### Requirement: Tours store

A Pinia store (`useToursStore`) SHALL manage the list of tours with reactive `tours`, `isLoading`, and `error` state.

#### Scenario: Auto-load on authentication

- **WHEN** the auth store transitions to authenticated
- **THEN** the tours store SHALL automatically fetch all tours for the current user

#### Scenario: Create tour from draft

- **WHEN** `createTourFromDraft(draft, location)` is called with an extended TourDraft and a LatLng location
- **THEN** the store SHALL generate a UUID, create the tour via the repository with all fields, refresh the tours list, and return the new tour id

#### Scenario: Create tour from draft without authenticated user

- **WHEN** `createTourFromDraft(draft, location)` is called while no user is authenticated
- **THEN** the store SHALL return `null` and SHALL NOT call the repository

#### Scenario: Clear on sign-out

- **WHEN** the auth store signs out
- **THEN** the tours store SHALL clear its cached tours list

## ADDED Requirements

### Requirement: Auto-open info sheet after tour creation

After a new tour is successfully saved from the creation dialog, the map page SHALL select the newly created tour so that the tour info sheet opens and the map flies to its goal location.

#### Scenario: Info sheet opens for new tour

- **WHEN** the user saves a new tour from the tour creation dialog
- **AND** the store returns a non-null tour id
- **THEN** the map page SHALL set the selected tour id to that new id
- **AND** the tour info sheet SHALL be shown for the new tour
- **AND** the map SHALL fly to the new tour's goal location using the existing `flyToSelectedTour` behavior

#### Scenario: Save fails silently when unauthenticated

- **WHEN** the store returns `null` from `createTourFromDraft`
- **THEN** the map page SHALL NOT change the selected tour id
- **AND** no info sheet SHALL be opened
