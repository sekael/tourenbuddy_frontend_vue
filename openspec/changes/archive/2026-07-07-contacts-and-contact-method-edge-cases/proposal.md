## Why

Contacts, contact methods, verified phones, and friendships interact in ways that
currently leave the data inconsistent and the UI misleading (issue #208):

- The same phone number can be attached to many contacts, so a "verified phone"
  does not map to a single contact — and the friendship/pending-request state
  tied to that phone is ambiguous.
- Editing a phone method silently leaves the friend request/friendship that was
  created against the old number stale.
- A blank/cancelled add-method draft leaves a stale error that makes the whole
  contact refuse to save even though the network calls return 200 OK.

## What Changes

**Group 1 — A contact method is unique to one contact per user**
- Add a DB unique index `(user_id, method_type, value)` on `contact_methods`, so a
  phone (or email) belongs to at most one contact per user. A pre-index dedupe
  step collapses any existing duplicates. The existing per-contact unique
  constraint stays.
- When a user adds a contact/method whose value already exists on another of
  their contacts, show a disclaimer ("a contact with this number already exists —
  edit instead") offering to open the existing contact or discard the draft.
  Applies to the manual add-contact form, add-method-on-existing-contact, and
  vCard/device import (import skips the cross-contact duplicate instead of erroring).
- **BREAKING (data):** existing cross-contact duplicate phone/email rows are
  removed by the migration; a losing contact keeps its other methods.

**Group 2 — Editing a phone method's value evicts the linked friend relationship**
- Three DB "break-point" triggers already terminate friendships + pending requests
  in the same transaction (contact delete, phone-method delete, own-phone delete).
  Editing a phone method's *value* is a fourth break-point with no trigger, so the
  relationship created against the old number goes stale.
- Add a `BEFORE UPDATE` trigger on `contact_methods` that mirrors the delete
  trigger: when a phone value changes, terminate the relationship resolved from the
  **old** value (remove friendship, cancel outgoing / deny incoming pending) in the
  same transaction, reusing `terminate_pending_and_friendship_between`. Friend
  requests stay user↔user; no FK/association is added.
- The edit UI shows a warning and, on confirm, persists the edit then calls the
  client `removeFriendship` for the old peer — **pending** termination is DB-owned
  (the trigger), while **friendship** removal goes through the client for the
  tour-link group-notification fanout the trigger cannot do. Same warn/confirm
  pattern the delete path uses (the delete path is already fully DB-enforced).
- `method_type` becomes immutable at the DB (a type flip keeping the same value
  would break a friend link without tripping the value-change break-point).

**Group 3 — Fix the stale contact-save error**
- Cancelling or leaving blank an add-method draft no longer blocks saving the
  contact. The stale `addMethodError` is cleared on cancel and is only considered
  by the form-level save while the add-method form is actually open.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `contacts`: a contact method value is unique to one contact per user;
  add-contact / add-method / edit surfaces show a duplicate disclaimer; editing a
  phone method warns and evicts the friend relationship linked to the old value;
  form-level save ignores a cancelled/blank add-method draft.
- `friendships`: adds a fourth break-point — editing the phone `contact_method`
  value that resolves to a friend/pending user terminates the friendship and
  cancels/denies the pending request for the old value, in the same transaction
  (the three existing break-points are unchanged).
- `contact-device-import`: import (phones only — emails are not persisted on import)
  detects a phone already held by another of the user's contacts and skips it; if a
  contact's phones are all duplicates it is skipped entirely rather than created
  name-only. Import results are shown as a grouped summary box.

## Impact

- **DB:** new migrations — (a) dedupe existing duplicates + unique index
  `(user_id, method_type, value)` on `public.contact_methods`; (b) `BEFORE UPDATE`
  break-point trigger reusing `terminate_pending_and_friendship_between`, plus a
  guard raising on any `method_type` change; (c) `create_contact_with_methods` RPC
  so manual add (and import, which shares the path) is atomic. Local-first, pushed
  to prod only after verification.
- **Data layer:** `contact-methods-repository-impl.ts` maps the new cross-contact
  unique violation (`23505`) to a new domain error on **both** `addMethod` and
  `updateMethod`, distinct from the existing per-contact `DuplicateContactMethodError`;
  new error class in `core/exceptions/`. `contacts-repository-impl.ts` calls the
  atomic create RPC.
- **Stores:** `contacts-store.ts` (duplicate lookup helper; edit path persists the
  update then calls `removeFriendship(oldPeer)` for notification parity — pending
  termination stays DB-owned).
- **UI:** `contact-form.vue`, `contact-detail-view.vue` (duplicate disclaimer,
  edit-evict confirm, stale-error fix), import composables/components.
- **i18n:** new disclaimer/warning keys in `en.json` and `de-CH.json`.
- **No new dependencies.**
