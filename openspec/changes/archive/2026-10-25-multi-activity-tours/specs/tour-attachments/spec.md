## MODIFIED Requirements

### Requirement: Reorder attachments

The user SHALL be able to reorder attachments by dragging a row's handle with a mouse, a pen or a finger, or by the arrow keys on a focused handle. The new order SHALL be persisted atomically via a single RPC `update_attachment_order(tour_id uuid, ordered_ids uuid[])`.

#### Scenario: Reorder via drag

- **WHEN** the user moves attachment B above attachment A
- **THEN** the RPC SHALL be invoked with the new ordered id list AND the persisted `sort_order` values SHALL reflect the new order

#### Scenario: Reorder by finger on a phone

- **WHEN** the user drags attachment B's handle above attachment A on an Android phone
- **THEN** the attachments SHALL reorder as with a mouse (no reliance on native HTML drag-and-drop)

#### Scenario: Reorder is atomic

- **WHEN** the RPC fails partway
- **THEN** no `sort_order` change SHALL be visible (transactional)
