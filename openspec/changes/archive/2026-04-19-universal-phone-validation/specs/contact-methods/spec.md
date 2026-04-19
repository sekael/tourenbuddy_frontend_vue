## MODIFIED Requirements

### Requirement: ContactMethod model with Zod validation

A Zod schema SHALL define the contact method shape based on the existing `contact_methods` Supabase table. The `contactMethodRowSchema` SHALL parse: `id` (string), `contact_id` (string), `method_type` (enum: `phone` | `email`), `value` (string), `label` (string, nullable), `is_primary` (boolean), `is_valid` (boolean, default `true`). The `contactMethodSchema` SHALL transform to camelCase: `contactId`, `methodType`, `isPrimary`, `isValid`. When `methodType === 'phone'` and `isValid` is `true`, the schema SHALL refine `value` to require E.164 form (`^\+[1-9]\d{1,14}$`). Phone rows with `isValid === false` (legacy/unparseable) SHALL skip the E.164 refinement so the UI can surface them for repair.

#### Scenario: Valid phone method from Supabase

- **WHEN** a `contact_methods` row with `method_type = 'phone'`, `value = '+41791234567'`, `is_valid = true` is fetched
- **THEN** the Zod schema SHALL parse it into a typed `ContactMethod` object with `methodType: 'phone'`, `isValid: true`

#### Scenario: Phone method with non-E.164 value rejected when isValid=true

- **WHEN** a row with `method_type = 'phone'`, `value = '079 123 45 67'`, `is_valid = true` is parsed
- **THEN** the Zod schema SHALL fail validation

#### Scenario: Legacy invalid phone parsed as flagged

- **WHEN** a row with `method_type = 'phone'`, `value = 'ext. 1234'`, `is_valid = false` is parsed
- **THEN** the Zod schema SHALL succeed and produce a method with `isValid: false`

#### Scenario: Method with label

- **WHEN** a contact method has a `label` value (e.g., "Mobile", "Work")
- **THEN** the parsed `ContactMethod` object SHALL include the label

### Requirement: ContactMethods repository

A `ContactMethodsRepository` interface SHALL provide methods to add, update, and remove contact methods on the `contact_methods` table. Phone-typed `addMethod` and `updateMethod` calls SHALL invoke `normalizePhone` on the input `value`. If normalization fails, the repository SHALL throw a validation error and SHALL NOT perform the database write. If normalization succeeds, the repository SHALL persist the E.164 form.

#### Scenario: Add phone method with valid input

- **WHEN** `addMethod(contactId, { methodType: 'phone', value: '079 123 45 67', isPrimary: true })` is called
- **THEN** the repository SHALL INSERT into `contact_methods` with `value = '+41791234567'` and return the created row

#### Scenario: Add phone method with invalid input rejected

- **WHEN** `addMethod(contactId, { methodType: 'phone', value: '123', isPrimary: true })` is called
- **THEN** the repository SHALL throw a validation error and SHALL NOT INSERT

#### Scenario: Update phone method normalizes value

- **WHEN** `updateMethod(methodId, { value: '+49 30 1234567' })` is called on a phone method
- **THEN** the repository SHALL UPDATE with `value = '+49301234567'`

#### Scenario: Update phone method with invalid value rejected

- **WHEN** `updateMethod(methodId, { value: 'abc' })` is called on a phone method
- **THEN** the repository SHALL throw a validation error and SHALL NOT UPDATE

#### Scenario: Remove method

- **WHEN** `removeMethod(methodId)` is called
- **THEN** the repository SHALL DELETE the row from `contact_methods`

## ADDED Requirements

### Requirement: is_valid column on contact_methods

The `contact_methods` table SHALL include a boolean column `is_valid` defaulting to `true`. The migration described in the change's design SHALL set `is_valid = false` for any pre-existing phone row whose `value` cannot be normalized to E.164. New rows written via the repository (post-migration) SHALL always have `is_valid = true` (or be rejected before insert).

#### Scenario: Migration flags unparseable legacy rows

- **WHEN** the one-time migration runs against a row with `method_type='phone'`, `value='ext. 1234'`
- **THEN** the row's `value` SHALL remain unchanged
- **AND** `is_valid` SHALL be set to `false`

#### Scenario: Migration normalizes parseable rows

- **WHEN** the migration runs against a row with `value='079 123 45 67'`
- **THEN** the row's `value` SHALL be updated to `'+41791234567'`
- **AND** `is_valid` SHALL remain `true`
