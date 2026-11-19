## REMOVED Requirements

### Requirement: Abuse reporting captured but no moderation pipeline
**Reason**: App Review guideline 1.2 needs a timely response to reports; a capture-only table nobody watches cannot give one.
**Migration**: Replaced by "Abuse reports alert the operator" below; the RPC, table and Block UI stay as they were.

## ADDED Requirements

### Requirement: Abuse reports alert the operator
The `report_user(target_user_id uuid, reason text)` SECURITY DEFINER RPC SHALL record reports in `public.abuse_reports` as the caller (`reporter_user_id = auth.uid()`), offered from the Block UI. Every inserted or repeated report SHALL reach the Worker, which SHALL email the moderation address with both accounts and the reason. No automated action SHALL run on the reported user.

#### Scenario: Report inserted
- **WHEN** user A invokes `report_user(B, "spam")` for the first time
- **THEN** a row `(reporter_user_id = A, reported_user_id = B, reason = 'spam', created_at = now())` is inserted in `abuse_reports`

#### Scenario: Repeat report upserts reason and timestamp
- **WHEN** user A invokes `report_user(B, <new reason>)` and a prior row `(A, B)` already exists
- **THEN** the existing row is UPDATEd with the new reason and `created_at = now()`; no duplicate row is inserted

#### Scenario: Block-and-report runs both
- **WHEN** user A confirms Block with the "Also report" option checked
- **THEN** `block_user(B)` runs followed by `report_user(B, <reason>)` in the same UI flow

#### Scenario: Operator alerted
- **WHEN** an `abuse_reports` row is inserted or updated and the Worker has a moderation address
- **THEN** the moderation address receives an email naming the reporter, the reported user and the reason, and nothing else happens to either account

#### Scenario: Worker unreachable or unconfigured
- **WHEN** the Worker cannot be reached or has no moderation address
- **THEN** the report stays committed and the reporter sees the usual confirmation

#### Scenario: Reporter sees confirmation
- **WHEN** the report RPC succeeds
- **THEN** the client shows a localized confirmation
