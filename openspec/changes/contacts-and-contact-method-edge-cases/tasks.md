## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/208-contact-method-edge-cases`

## 2. DB — per-user uniqueness (Group 1)

- [x] 2.1 `supabase migration new contact_method_value_unique_per_user`
- [x] 2.2 In the migration, dedupe existing rows: for each `(user_id, method_type, value)` group with >1 row, keep exactly one via `order by is_primary desc, id asc`, delete the rest
- [x] 2.3 Re-promote primary: any contact left with phone methods but no primary gets its lowest-`id` phone set `is_primary = true`
- [x] 2.4 `create unique index contact_methods_value_unique_per_user on public.contact_methods (user_id, method_type, value)`
- [x] 2.5 `supabase db reset`; confirm the index builds and dedupe leaves each contact with a primary phone

## 3. DB — edit break-point trigger + immutable type (Group 2)

- [x] 3.1 `supabase migration new cleanup_on_contact_method_update`
- [x] 3.2 Create `public.cleanup_on_contact_method_update()` mirroring `cleanup_on_contact_method_delete()` but resolving `OLD.value` and calling `terminate_pending_and_friendship_between(v_owner, array[v_peer])`
- [x] 3.3 Add `BEFORE UPDATE ON public.contact_methods FOR EACH ROW WHEN (old.method_type = 'phone' AND new.value IS DISTINCT FROM old.value)` trigger; mirror the sibling `revoke`/`grant` convention
- [x] 3.4 Add a `BEFORE UPDATE` guard that raises if `new.method_type IS DISTINCT FROM old.method_type` (method_type immutable — F5)
- [x] 3.5 `supabase db reset`; manually verify: editing a phone linked to a friend deletes the friendship; editing a phone linked to a pending request cancels (sender) / denies (receiver) it; unlinked/unchanged phone is a no-op; changing `method_type` is rejected

## 4. DB — atomic contact create (Group 1, F1)

- [x] 4.1 `supabase migration new create_contact_with_methods` — `SECURITY DEFINER` RPC inserting the contact + all methods in one transaction (unique-violation aborts everything); `revoke all … from public`, `grant execute … to authenticated`
- [x] 4.2 `supabase db reset`; verify a duplicate phone in the payload leaves no orphan contact row

## 5. Data layer — duplicate mapping + atomic create (Group 1)

- [x] 5.1 Add `DuplicateContactAcrossContactsError` to `core/exceptions/` (export from the barrel)
- [x] 5.2 In `contact-methods-repository-impl.ts`, map `23505` on `contact_methods_value_unique_per_user` to the new error on BOTH `addMethod` and `updateMethod`; keep `contact_methods_unique_per_contact` → `DuplicateContactMethodError`
- [x] 5.3 Route `contacts-repository-impl.ts` create through the `create_contact_with_methods` RPC; map its `23505` to the new error

## 6. Store — duplicate lookup + edit-evict resolution (Groups 1 & 2)

- [x] 6.1 Add a `findContactByMethodValue(methodType, value, exceptContactId?)` helper to `contacts-store.ts` that scans the loaded `contacts` for a matching normalised value on a different contact
- [x] 6.2 Adapt `addContact` to the atomic create RPC (build the methods payload, keep primary/dedupe prep); confirm import path still works through it
- [x] 6.3 Verify the edit path resolves `relationshipsForPhone(oldValue)` (OLD value, not new)

## 7. UI — duplicate disclaimer (Group 1)

- [x] 7.1 In `contact-form.vue` (new contact, phones only), pre-check on submit each phone against `findContactByMethodValue`; a single hit blocks the whole save (no partial create) and shows the disclaimer ("could not be added — a contact with this number already exists")
- [x] 7.2 Disclaimer actions: "edit existing" opens the conflicting contact in edit mode (switch `contacts-list-sheet` `viewState` to `detail`, edit mode) and abandons the draft; "discard" abandons the whole draft
- [x] 7.3 In `contact-detail-view.vue` add-method flow (phone AND email), apply the same pre-check; on a hit show the disclaimer instead of inserting
- [x] 7.4 Map the DB `DuplicateContactAcrossContactsError` to a degraded generic disclaimer (discard only, no contact name/deep-link) for the race/stale-cache path

## 8. UI — edit-evict warning (Group 2)

- [x] 8.1 On phone-value save: run the duplicate pre-check FIRST — if the new value collides, show the duplicate disclaimer and stop (no eviction warning)
- [x] 8.2 If the edit can commit and the OLD value resolves to a friend/pending user, show the inline warn/confirm; on confirm persist the update FIRST (trigger terminates), THEN call `friendshipsStore.removeFriendship(oldPeerUserId)` for notification fanout (idempotent no-op delete). Pending termination is DB-owned

## 9. UI — stale save-error fix (Group 3)

- [x] 9.1 In `contact-detail-view.vue`, clear `addMethodError` inside `cancelAddMethod`
- [x] 9.2 Change the `saveAll` failure gate to `hasMethodError || (showAddMethod && addMethodError.value)`

## 10. Import — cross-contact dedupe + results box (Group 1)

- [x] 10.1 In the import path (`use-contact-import` / `use-vcard-import`), skip a phone already held by another existing contact; track skipped-duplicate entries for the results view (phones only — emails not persisted)
- [x] 10.2 If ALL of an imported contact's phones are cross-contact duplicates, skip the whole contact (no name-only orphan) and report it as skipped
- [x] 10.3 Redesign the import-results view from the bare "X skipped" label into a grouped summary box (imported / already-on-another-contact / unparseable), omitting empty categories

## 11. i18n

- [x] 11.1 Add duplicate-disclaimer, edit-evict warning, and import-summary keys to `en.json` AND `de-CH.json` (mirror existing `contacts.detailView.*` / `contacts.form.*` naming)

## 12. Tests (edge/failure only)

- [x] 12.1 Store unit: `findContactByMethodValue` returns the other contact for a normalised match and ignores the same contact / non-matches
- [x] 12.2 Repository unit: `23505` on the per-user index maps to `DuplicateContactAcrossContactsError` on both add and update; per-contact violation still maps to `DuplicateContactMethodError`
- [x] 12.3 Component: cancelling a blank add-method draft then saving the contact succeeds (no stale error); an open add-method form with an invalid value still blocks save (existing test already covers the blocking case)
- [x] 12.4 Component: editing a phone linked to a friend/pending shows the warning and does not send the update until confirmed; a new value that duplicates another contact shows the duplicate disclaimer instead of the eviction warning
- [x] 12.5 DB/integration: manually verified against local Supabase via psql — editing a phone evicts the old friendship (2→1 rows) and denies the old pending request; `method_type` change is rejected; unchanged-value update is a no-op; atomic create leaves no orphan contact on a duplicate-phone payload (no test harness exists for DB integration tests in this repo, so this was verified interactively rather than via an automated test file)

## 13. Finalize

- [x] 13.1 `npx eslint . --fix` and confirm the diff stays minimal (guard against editor reformatting)
- [x] 13.2 `npm run type-check` and `npm run test` — all green
- [ ] 13.3 Prompt the user to commit (do not commit): `feat(contacts): unique contact methods per user, evict friends on phone edit, fix stale save error (#208)`
- [ ] 13.4 Prompt the user to push and open a PR; do NOT `supabase db push` unprompted (separate deploy step after review, verified against a prod snapshot given the destructive dedupe)
