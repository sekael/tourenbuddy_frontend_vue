## ADDED Requirements

### Requirement: Dedupe phones on contact creation

The contacts store's `createContact` action SHALL deduplicate its incoming `phones` argument by `(methodType, value)` before issuing repository inserts, mirroring the database `UNIQUE (contact_id, method_type, value)` constraint. The merge SHALL OR the `isPrimary` flags across collapsed entries and SHALL keep the first non-null `label` in input order. The deduplicated list SHALL preserve the relative order of first occurrences. The store SHALL emit a `debug`-level log line via `useLogger` whenever it collapses one or more entries so duplicate-emitting callers surface in development consoles.

#### Scenario: createContact called with duplicate phones

- **WHEN** `createContact` is called with `phones: [{ value: '+41 79 123 45 67', label: null, isPrimary: true }, { value: '+41 79 123 45 67', label: 'Mobile', isPrimary: false }]`
- **THEN** the repository SHALL receive exactly one phone with `value: '+41 79 123 45 67'`, `label: 'Mobile'` (first non-null), and `isPrimary: true`

#### Scenario: createContact preserves distinct phones

- **WHEN** `createContact` is called with two phones whose `value` differ
- **THEN** the repository SHALL receive both phones unchanged in order

#### Scenario: createContact dedupe across methodType boundaries

- **WHEN** `createContact` would insert both a `phone` and an `email` method with identical `value` strings
- **THEN** both methods SHALL be inserted because the dedupe key includes `methodType`

### Requirement: addContact accepts emails for import flows

The contacts store's `addContact` action SHALL accept an optional `emails: string[]` argument. After phones are inserted, each email SHALL be inserted as an `email` contact method via `contactMethodsRepository.addMethod`. Emails SHALL be deduplicated by lowercase-trim comparison before insertion. The first email in input order SHALL be inserted with `isPrimary: true`; remaining emails SHALL be inserted with `isPrimary: false`. If both `phones` and `emails` are non-empty, both arrays SHALL be inserted in full (no method-type interaction). Existing callers that omit `emails` SHALL behave identically to today.

#### Scenario: addContact called with emails only

- **WHEN** `addContact(firstName, lastName, displayName, phones: [], source: 'import', emails: ['friend@example.com', 'other@example.com'])` is called
- **THEN** the repository SHALL insert two `email` contact methods AND zero phone methods, with the first email having `isPrimary: true`

#### Scenario: addContact called with phones and emails

- **WHEN** `addContact` is called with one phone and one email
- **THEN** one `phone` method and one `email` method SHALL be inserted, each marked `isPrimary: true` within its method type

#### Scenario: Email dedupe before insertion

- **WHEN** `addContact` is called with `emails: ['Foo@Example.com', 'foo@example.com']`
- **THEN** exactly one `email` method SHALL be inserted with `value: 'foo@example.com'`

#### Scenario: addContact called without emails argument (existing callers)

- **WHEN** `addContact` is called without the `emails` argument
- **THEN** behavior SHALL match today (only phones, if any, are inserted)

### Requirement: Map contact-method unique-violation to friendly error

The `ContactMethodsRepository` and any repository path that inserts into `contact_methods` SHALL detect Postgres error `code === '23505'` originating from constraint `contact_methods_unique_per_contact` and SHALL throw a typed `DuplicateContactMethodError` (in `core/exceptions/`) carrying the i18n key `contacts.errors.duplicateMethod`. The raw Postgres message and constraint name SHALL NOT be propagated to user-facing snackbars. The i18n key SHALL exist in both `en.json` and `de-CH.json` with a human-readable message.

#### Scenario: Unique-violation surfaced as typed error

- **WHEN** an insert into `contact_methods` rejects with Postgres `code === '23505'` and `constraint === 'contact_methods_unique_per_contact'`
- **THEN** the repository SHALL throw `DuplicateContactMethodError` whose message resolves via i18n key `contacts.errors.duplicateMethod`

#### Scenario: Other Postgres errors pass through unchanged

- **WHEN** an insert into `contact_methods` rejects with a non-`23505` error
- **THEN** the repository SHALL NOT map the error and SHALL propagate it unchanged

#### Scenario: i18n keys present in all locales

- **WHEN** the locale bundles are loaded
- **THEN** `contacts.errors.duplicateMethod`, `contacts.errors.noValidPhone`, and `contacts.errors.someInvalidPhonesDiscarded` SHALL be defined in both `en.json` and `de-CH.json`
