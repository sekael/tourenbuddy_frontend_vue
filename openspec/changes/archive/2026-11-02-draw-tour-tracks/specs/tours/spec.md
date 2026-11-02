## ADDED Requirements

### Requirement: An exact copy of an own tour is not saved twice

Saving a new tour (not a new segment, without attachments) that matches one of the owner's tours
in every field they set, with a track through the same points or neither with a track, SHALL NOT
create a second tour: the existing tour SHALL open with a notice saying the user already has it,
and the copy's uploaded track SHALL be removed. A track that can't be loaded counts as different.

#### Scenario: A ski route planned twice

- **WHEN** the user plans the same ski route as a tour twice and saves both times without changing anything
- **THEN** only one tour SHALL exist, and the second save SHALL open it with the notice

#### Scenario: Something changed

- **WHEN** the second plan gets a planned date before it is saved
- **THEN** it SHALL be saved as a tour of its own

#### Scenario: The track can't be compared

- **WHEN** the existing tour's track can't be loaded (offline, never cached)
- **THEN** the new tour SHALL be saved as usual
