## ADDED Requirements

### Requirement: Tours store reconciles cached partnerIds on contact deletion

The `useToursStore` Pinia store SHALL keep its cached `Tour.partnerIds` consistent with the contacts store. When the contacts store completes a successful `deleteContact` action, the tours store SHALL remove the deleted contact's id from `partnerIds` of every cached tour. The reconciliation SHALL be in-memory only (no repository call) and SHALL preserve all other tour fields and the order of remaining `partnerIds`.

#### Scenario: Deleted contact id removed from cached tours

- **WHEN** the contacts store's `deleteContact(contactId)` action completes successfully
- **AND** one or more cached tours include `contactId` in their `partnerIds`
- **THEN** the tours store SHALL emit a new `tours` array where `contactId` has been removed from every affected tour's `partnerIds`
- **AND** all other tour fields SHALL remain unchanged
- **AND** the relative order of remaining `partnerIds` SHALL be preserved

#### Scenario: No-op when deleted contact is not referenced

- **WHEN** the contacts store's `deleteContact(contactId)` action completes successfully
- **AND** no cached tour has `contactId` in its `partnerIds`
- **THEN** the tours store SHALL NOT mutate any cached tour

#### Scenario: Failed contact deletion leaves cache untouched

- **WHEN** the contacts store's `deleteContact(contactId)` action throws
- **THEN** the tours store SHALL NOT modify any cached tour's `partnerIds`

#### Scenario: Subsequent tour update sends reconciled partnerIds

- **WHEN** a contact has been deleted and removed from cached tours via the reconciliation
- **AND** the user saves an edit to one of those tours without changing the partner selection
- **THEN** the `update_tour_full` RPC call SHALL receive `p_partner_ids` without the deleted contact id

### Requirement: Tour partner details resolved live from contacts store

Tour-feature views and components SHALL resolve partner details (display name, phones, primary phone, contact methods) live from `useContactsStore.contacts` by joining on `Tour.partnerIds`. Tour entities and tour-feature state SHALL NOT cache snapshots of `Contact` fields. As a consequence, any successful mutation in the contacts store — `updateContact`, `addMethodToContact`, `updateMethodOnContact`, `setPrimaryPhoneOnContact`, `removeMethodFromContact` — SHALL be reflected in any open tour view that references the affected contact, on the next reactivity tick, without any explicit reconciliation by the tours feature.

#### Scenario: Contact rename reflected in partner chip

- **WHEN** a contact assigned as a tour partner is renamed via `contactsStore.updateContact`
- **AND** the tour info sheet for that tour is open
- **THEN** the partner chip SHALL display the new name on the next reactivity tick

#### Scenario: Primary phone change reflected in call action

- **WHEN** the primary phone of a contact assigned as a tour partner is changed via `contactsStore.setPrimaryPhoneOnContact` (or via `addMethodToContact`/`updateMethodOnContact` setting `isPrimary: true`)
- **AND** the user opens the contact action menu from the partner chip in the tour info sheet
- **THEN** the call and messaging actions SHALL target the new primary phone

#### Scenario: Removed contact method no longer offered as action

- **WHEN** a phone contact method on a contact assigned as a tour partner is removed via `contactsStore.removeMethodFromContact`
- **AND** the user opens the contact action menu from the partner chip in the tour info sheet
- **THEN** the removed method SHALL NOT appear among the offered actions

#### Scenario: Tour entity does not snapshot contact fields

- **WHEN** the `Tour` Zod schema and entity definitions are inspected
- **THEN** they SHALL contain only `partnerIds` (an array of contact ids) and SHALL NOT contain partner names, phones, or other denormalized contact fields
