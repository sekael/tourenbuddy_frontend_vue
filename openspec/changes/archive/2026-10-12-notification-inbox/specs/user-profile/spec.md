# Spec Delta

## MODIFIED Requirements

### Requirement: Notification preference fields on user profile
The user profile SHALL persist the email channel toggle and a list of muted notification types. Push enablement SHALL NOT be stored on the profile: it is per device, represented by the device's `push_subscriptions` row.

#### Scenario: New columns present
- **WHEN** a user profile is read
- **THEN** the result includes `notif_email_enabled: boolean` and `notif_muted_types: string[]`, and no account-wide push flag

#### Scenario: Defaults
- **WHEN** a profile row is created without explicit notification fields
- **THEN** email defaults to disabled and muted types defaults to empty
