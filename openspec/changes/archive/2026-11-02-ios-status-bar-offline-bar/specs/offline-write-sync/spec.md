## MODIFIED Requirements

### Requirement: A durable pending-sync indicator surfaces unsynced work

The system SHALL surface the count of pending offline writes on a durable indicator, the offline bar at the top, read from the queue on every launch. The transient "N changes waiting to sync" text SHALL appear only when the queue transitions from empty to non-empty (the first pending change); while writes are already queued, subsequent changes SHALL only update the bar's count, not re-show the text.

#### Scenario: Text shown only on the first pending change

- **WHEN** a first mutation is queued while the queue was empty
- **THEN** the "waiting to sync" text is shown briefly, and the count stays in the offline bar

#### Scenario: Later changes only bump the count

- **WHEN** a further mutation is queued while writes are already pending
- **THEN** the count increments without the text re-appearing
