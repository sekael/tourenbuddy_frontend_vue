## ADDED Requirements

### Requirement: ContactMethod model with Zod validation

A Zod schema SHALL define the contact method shape based on the existing `contact_methods` Supabase table. The `contactMethodRowSchema` SHALL parse: `id` (string), `contact_id` (string), `method_type` (enum: `phone` | `email`), `value` (string), `label` (string, nullable), `is_primary` (boolean). The `contactMethodSchema` SHALL transform to camelCase: `contactId`, `methodType`, `isPrimary`.

#### Scenario: Valid phone method from Supabase

- **WHEN** a `contact_methods` row with `method_type = 'phone'` is fetched
- **THEN** the Zod schema SHALL parse it into a typed `ContactMethod` object with `methodType: 'phone'`

#### Scenario: Method with label

- **WHEN** a contact method has a `label` value (e.g., "Mobile", "Work")
- **THEN** the parsed `ContactMethod` object SHALL include the label

### Requirement: ContactMethods repository

A `ContactMethodsRepository` interface SHALL provide methods to add and remove contact methods from the `contact_methods` table.

#### Scenario: Add phone method

- **WHEN** `addMethod(contactId, { methodType: 'phone', value: '+41 79 123 45 67', isPrimary: true })` is called
- **THEN** the repository SHALL INSERT into `contact_methods` and return the created row

#### Scenario: Remove method

- **WHEN** `removeMethod(methodId)` is called
- **THEN** the repository SHALL DELETE the row from `contact_methods`

### Requirement: Primary phone helper

A `getPrimaryPhone(contact)` utility function SHALL extract the primary phone number from a contact's methods array.

#### Scenario: Contact has primary phone

- **WHEN** a contact has a contact method with `methodType: 'phone'` and `isPrimary: true`
- **THEN** `getPrimaryPhone` SHALL return that method's `value`

#### Scenario: Contact has no phone methods

- **WHEN** a contact has no contact methods with `methodType: 'phone'`
- **THEN** `getPrimaryPhone` SHALL return `null`

#### Scenario: Contact has phone but none primary

- **WHEN** a contact has phone methods but none with `isPrimary: true`
- **THEN** `getPrimaryPhone` SHALL return the first phone method's `value`
