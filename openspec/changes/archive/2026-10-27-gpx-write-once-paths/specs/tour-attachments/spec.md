## MODIFIED Requirements

### Requirement: Accepted file is copied into the owner's prefix

On accepting a `gpx` or `attachment_add` suggestion, the system SHALL copy the staged
object into the owner's own prefix before recording the change, and the persisted
`gpx_filepath` / `storage_path` SHALL reference the owner's copy. The tour SHALL never
reference an object whose lifetime is controlled by a non-owner. A GPX copy SHALL land at a
fresh key, never at the tour's current `gpx_filepath`. A failed accept SHALL remove its
copies only when the server answered.

#### Scenario: Accepted attachment references the owner's copy
- **WHEN** the owner accepts an `attachment_add` suggestion
- **THEN** a copy is created under the owner's prefix and the new `tour_attachments` row references that path

#### Scenario: Author deleting their staged file does not break an accepted attachment
- **WHEN** the author later deletes their staged object
- **THEN** the accepted attachment still resolves, because it references the owner's copy

#### Scenario: Accepted GPX replaces the tour's own track
- **WHEN** the owner accepts a `gpx` suggestion on a tour created with a GPX at `<owner uid>/<tour id>.gpx`
- **THEN** the copy lands at a fresh key, `gpx_filepath` references it, and the previous object is removed while the accepted track stays readable

#### Scenario: Rejected accept removes its copy
- **WHEN** the accept RPC returns a server error
- **THEN** the client removes the copy it made, and a failed removal is logged

#### Scenario: Accept with unknown outcome keeps its copy
- **WHEN** the accept call fails without a server answer (no response, network error)
- **THEN** the copy is kept, since the accept may have committed and the tour may already reference it

#### Scenario: Batch copy fails part-way
- **WHEN** copying one file of a batch accept fails after earlier copies succeeded
- **THEN** the earlier copies are removed and the accept RPC is not called
