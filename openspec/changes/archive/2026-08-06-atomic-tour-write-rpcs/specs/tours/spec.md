## ADDED Requirements

### Requirement: Tour creation is a single atomic idempotent call

Creating a tour SHALL be performed as a single atomic backend call that writes the
tour row and its partners, sets its visibility, and records its GPX filepath
together. The call SHALL be idempotent by tour id: replaying the same create for an
id that already exists SHALL be a safe no-op that does not duplicate or alter the
existing tour or its partners. The GPX upload SHALL remain best-effort — a failed
upload SHALL NOT prevent the tour from being created.

#### Scenario: Create sets visibility and GPX in one call

- **WHEN** a tour is created with a non-default visibility and a GPX file
- **THEN** the tour row, its partners, its visibility, and its GPX filepath are all
  persisted by a single atomic call, with no follow-up visibility or filepath write

#### Scenario: Replayed create is a no-op

- **WHEN** the create for a tour id that already exists is issued again
- **THEN** the existing tour and its partners are left unchanged and no duplicate is
  created

#### Scenario: GPX upload failure still creates the tour

- **WHEN** the GPX upload fails during creation
- **THEN** the tour is still created with a null GPX filepath

### Requirement: Tour update is a single atomic update-only call

Updating a tour SHALL be performed as a single atomic backend call that updates the
tour row and its partners and MAY set its visibility and GPX filepath in the same
call. Visibility SHALL be changed only when explicitly provided, leaving the existing
value untouched otherwise. The call SHALL be update-only: if the tour no longer
exists it SHALL make no change and SHALL NOT recreate the row.

#### Scenario: Update sets visibility atomically when provided

- **WHEN** a tour edit includes a visibility change
- **THEN** the row, partners, and visibility are updated by a single atomic call
  with no separate visibility write

#### Scenario: Update without visibility leaves it untouched

- **WHEN** a tour edit does not include a visibility value
- **THEN** the tour's existing visibility is unchanged

#### Scenario: Update of a deleted tour does not resurrect it

- **WHEN** an update is issued for a tour id that no longer exists on the server
- **THEN** no row is created and the caller can observe that no row was updated

### Requirement: Standalone visibility toggle is preserved

The standalone visibility-toggle action SHALL remain available independently of tour
creation and editing, applying its tour-links eviction and friendship-facing side
effects. The atomic create/update visibility parameter SHALL be additive and SHALL
NOT remove or bypass the standalone toggle.

#### Scenario: Visibility toggled outside create/edit

- **WHEN** the user toggles a tour's visibility directly (not through the create or
  edit form)
- **THEN** the visibility change is applied with its usual eviction/notification side
  effects, independently of the atomic create/update path
