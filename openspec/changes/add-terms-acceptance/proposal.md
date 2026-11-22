# Proposal

## Why

The native apps' new terms of use (tourenbuddy-native change `add-terms-acceptance`, legal review
PASS 2026-11-22) exclude the operator's liability and make users solely responsible for their
activities. They bind only users who accepted them, and the acceptance must be provable, must not
be skippable by any client on the production backend (this PWA included) and must be kept for 10
years after an account is deleted.

## What Changes

- **Acceptance record:** `terms_acceptances` (user, email, version, server time, `retain_until`).
  Clients read their own rows and never write them directly. `accept_terms(version)` records the
  version in force with the server's time; `terms_status()` returns the version in force and the
  user's latest accepted one.
- **Enforcement, behind a switch:** with the switch on, every client write to the app's tables and
  to the two storage buckets needs the current acceptance; the refusal is `terms_not_accepted`.
  Service-role, cron and trigger writes are not affected. The switch ships off and is turned on in
  a later migration, once every client carries the gate.
- **Retention:** deleting an account (any path) keeps its acceptance records for 10 years from the
  deletion; a daily job removes expired records, with a backstop for records whose account vanished
  without the mark.
- **PWA gate:** the same acceptance page as the native apps (same wording, states and actions)
  before any page of the app, before onboarding and before the push subscription.

## Capabilities

### New Capabilities

- `terms-acceptance`: the acceptance record, enforcement and retention, and the PWA's page.

### Modified Capabilities

- None: the record's life after an account deletion is a requirement of `terms-acceptance`; the
  deletion flow itself is unchanged (a trigger on `auth.users` marks the records).

## Impact

- Database: two migrations (record and switch off; switch on later), pgTAP suite.
- PWA: router guard, a terms page and store, locales, the offline queue's replay.
- Release: this PWA must be deployed with the gate before the native apps' backend switch goes on.
