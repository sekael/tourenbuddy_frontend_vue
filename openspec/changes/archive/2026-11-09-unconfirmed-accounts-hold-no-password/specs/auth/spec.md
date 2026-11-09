## ADDED Requirements

### Requirement: Unconfirmed accounts hold no password

The backend SHALL keep every account without a confirmed email address or phone number free of a
password, whoever creates or updates it, so that a password given to an address before its owner
confirmed it never signs in. Passwords set on confirmed accounts SHALL be kept.

#### Scenario: Password given through the open sign-up endpoint

- **WHEN** someone creates an account for an address that nobody has confirmed, with a password
- **THEN** the account holds no password, and signing in with that password fails

#### Scenario: Owner confirms the address with a code

- **WHEN** the address's owner later signs in with an email code, which confirms the address
- **THEN** the account still holds no password, and the stranger's password does not sign in

#### Scenario: Password set after confirmation

- **WHEN** a confirmed account sets a password
- **THEN** the password is kept and signs in

#### Scenario: Seeded and dashboard-created users

- **WHEN** a user is created already confirmed, with a password
- **THEN** the password is kept
