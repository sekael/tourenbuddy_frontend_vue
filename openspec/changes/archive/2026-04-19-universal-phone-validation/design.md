## Context

Phone numbers enter the system from four paths: manual add form, manual edit on contact detail, vCard file import, native Contact Picker. Each currently has its own validation/normalization behavior:

- `normalizePhone()` exists but returns spaced international (`formatInternational()`), not E.164.
- `useVCardImport` and `useContactPicker` retain raw values when normalization fails.
- Manual forms apply live formatting via `useAsYouTypePhone` but do not block save on `isValid()` failure consistently.
- `usePhoneActions` builds WhatsApp links only when input starts with `+`/`00`.

Result: stored phones are heterogeneous; downstream actions (call/WhatsApp links) and any future verification flow are unreliable. Default region is Switzerland (`CH`).

## Goals / Non-Goals

**Goals:**

- One canonical validation+normalization function used by every entry path.
- Single storage form: E.164 (e.g. `+41791234567`).
- Reject invalid non-empty phones at every persistence boundary (form submit, repository insert/update, import).
- Empty phone remains valid (contacts without phone allowed).
- Preserve user's verified phone flow (OTP) untouched — applies to user profile, not contact methods.
- Migrate existing rows; flag legacy invalid rows for user review without data loss.

**Non-Goals:**

- Phone verification (OTP) for contact methods. Contacts are not verified, only validated.
- Multi-region UI selection — region defaults to `CH`; users may type with `+` prefix for other regions, which `libphonenumber-js` already handles.
- Reformatting stored display style beyond E.164 (UI may format on render via existing helpers).

## Decisions

### Decision: Storage in E.164, display via `formatInternational()` on render

- **Rationale**: E.164 is unambiguous, fixed-shape, ideal for equality, indexes, and any external API (Twilio, Supabase Auth). Display formatting belongs in presentation layer.
- **Alternative considered**: Store `formatInternational()` (spaced). Rejected — whitespace variation breaks equality and external integrations.

### Decision: Centralize validation in `phone-normalize.ts`; expose `validateAndNormalize(input, region?) → Result`

- **Rationale**: One function, one truth. Existing `normalizePhone` is close — extend it to return E.164 instead of spaced form, and add a separate display formatter.
- **Alternative considered**: Per-feature validators. Rejected — exact reason for this change.
- **Shape**:
  - `normalizePhone(input, region='CH') → { ok: true, e164: string } | { ok: false, raw: string }` (BREAKING field rename)
  - `formatPhoneForDisplay(e164) → string` (uses `formatInternational()`)
  - `toE164` removed/inlined (redundant with new `normalizePhone`).

### Decision: Repository-level guard

- **Rationale**: Forms can have bugs; the repo is the last line. `ContactMethodsRepository.addMethod`/`updateMethod` re-validates `value` when `methodType === 'phone'` and throws if not valid E.164. Mirrors how Zod is used elsewhere.
- **Implementation**: Zod refine on `contactMethodSchema` for the phone branch.

### Decision: Import paths drop invalid phones into a separate "needs attention" bucket, not silent rejection

- **Rationale**: User explicitly imported these — silent drop violates least-surprise. Match existing "couldn't parse" UI pattern in import results.
- **Behavior**: Imports create the contact (name still useful) but skip the invalid phone method; results row shows the raw value with the existing indicator and a CTA to fix.

### Decision: Migration via SQL one-shot + application-side normalize-on-read fallback

- **Rationale**: Bulk normalize what we can in SQL using a Postgres function or via a one-time script (`scripts/migrate-phones-to-e164.ts`). For rows that fail, set a new `is_valid` boolean (default true; false for legacy bad rows) so the UI can flag them on next view. Avoids destructive deletion.
- **Alternative considered**: Lazy migration on read only. Rejected — leaves stale data and complicates equality checks indefinitely.

### Decision: `usePhoneActions` simplifies — assume input is E.164

- **Rationale**: All persisted phones are E.164 post-migration, so WhatsApp link is always producible. Keep the `null` handling for missing phone.

## Risks / Trade-offs

- **Risk**: Migration script flags many legacy rows as invalid → user UX disruption.
  → **Mitigation**: Run migration in staging; report counts before applying. Default to non-destructive flag, not deletion. Provide clear in-app affordance to fix.
- **Risk**: Stricter validation breaks vCard imports that previously "worked" (raw retained).
  → **Mitigation**: Existing UI already surfaces "couldn't parse"; behavior change is from "imported with raw" to "imported without phone + visible warning". Document in release notes.
- **Risk**: Default region `CH` rejects valid international numbers entered without `+`.
  → **Mitigation**: `libphonenumber-js` handles `+` prefix correctly regardless of default region. Form copy nudges user to include country code for non-Swiss numbers.
- **Risk**: Renaming `PhoneNormalizeResult.value → e164` is a code-wide rename.
  → **Mitigation**: TypeScript catches all call sites; small blast radius.

## Migration Plan

1. Land canonical utility + Zod schema changes; tests pass against new shape.
2. Land form/import enforcement; manual QA all four entry paths.
3. Run migration script against production:
   - Read all `contact_methods` rows where `method_type='phone'`.
   - For each: parse with `normalizePhone`; if `ok`, update `value` to E.164. If not, set `is_valid=false`, leave value untouched.
   - Log summary (updated / flagged / unchanged).
4. Deploy frontend that surfaces flagged rows.
5. Rollback: revert frontend; SQL changes are forward-compatible (E.164 is still a valid string, `is_valid` column is additive).

## Open Questions

- Should the `is_valid` column live on `contact_methods` or on a sidecar table? (Default: column on `contact_methods` — simpler.)
- Do we surface flagged rows in the contacts list, or only on the detail view? (Suggest: small icon on list row + clear callout on detail.)
- Default region remains `CH` — confirm no immediate plans for multi-region default.
