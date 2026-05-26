## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/85-friend-tour-visibility`

## 2. Database: visibility column

- [x] 2.1 `supabase migration new add_tours_visibility` — add `tours.visibility text NOT NULL DEFAULT 'friends'` with `CHECK (visibility IN ('private','friends'))`
- [x] 2.2 Expose `visibility` in `tours_view`
- [x] 2.3 `supabase db reset` to apply locally and confirm baseline + new migration run clean

## 3. Database: friend read authorization

- [x] 3.1 `supabase migration new friend_tour_read_access` — add `tours` SELECT policy for friends: friendship(owner, auth.uid()) AND `visibility = 'friends'`
- [~] 3.2 ~~Add matching `tour_partners` SELECT policy~~ — INTENTIONALLY OMITTED. The friend-read view delegates partner resolution to the SECURITY DEFINER `tour_partner_user_ids` helper and never returns raw `contact_id`s, so a friend-readable `tour_partners` policy would leak the owner's private contact UUIDs with no benefit. Friends never read `tour_partners` directly.
- [x] 3.3 **(YOUR GAP — done)** Implement the `tour_partner_user_ids(p_tour_id uuid) returns uuid[]` body — resolve tour_partners → contact_methods(phone) → auth.users with `ltrim('+')` normalization + confirmed-phone gate
- [x] 3.4 Create a `security_invoker = true` friend-read view (`friend_tours_view`), separate from `tours_view`, that returns friend tours and gates `planned_date`, `gpx_filepath` to null when `auth.uid()` is not in `tour_partner_user_ids(id)`
- [x] 3.5 In that friend-read path, return partners as registered-user profile names (`partner_names` via `get_user_names_by_ids`), never raw owner `partner_ids`; omit non-registered contacts
- [x] 3.6 Add a `tour-gpx` storage `SELECT` policy permitting a partner-friend (friendship + `visibility='friends'` + partner via helper); keep non-partner friends and private tours blocked
- [x] 3.7 Verify/lock the security mode of any view used for friend reads (`friend_tours_view` is explicit `security_invoker = true`)
- [x] 3.8 `supabase db reset` and verify locally (after filling 3.3)

## 4. Database: RLS verification tests

- [x] 4.1 Add SQL/integration checks: non-friend reading the friend view/RPC gets zero rows (`supabase/tests/friend_tour_visibility_rls.sql`)
- [x] 4.2 Verify private tour is invisible even to a marked partner friend
- [x] 4.3 Verify non-partner friend read returns row with gated columns; partner friend read returns full row
- [x] 4.4 Verify removing the friendship revokes read access

## 5. Frontend: tours data + store

- [x] 5.1 Add `visibility` to `tour-schema.ts` (Zod) and the `Tour` entity (default `friends`); new `visibility.ts` model + `friendTourRowSchema` mapping `friend_tours_view` → `Tour` with `isFriendTour`/`isPartner`/`partnerNames`
- [x] 5.2 Add friend-tour read to `tours-repository.ts` interface + Supabase impl (`listFriendTours` queries `friend_tours_view`)
- [x] 5.3 Add a `friendTours` collection + `loadFriendTours` action to `tours-store.ts`, separate from owned tours (loaded on auth; refetch-on-demand, realtime deferred to #198)
- [x] 5.4 Persist `visibility` on create (patch when non-default) + `setVisibility` action; `update_tour_full` intentionally leaves visibility untouched so edits never reset it

## 6. Frontend: visibility toggle UI

- [ ] 6.1 Add owner-only private/friends toggle to `tour-form.vue`
- [ ] 6.2 Add the same toggle (post-create) to `tour-info-sheet.vue`
- [ ] 6.3 Add i18n keys for visibility labels/help in `en.json` and `de-CH.json`

## 7. Frontend: list Owned/Friends tabs

- [ ] 7.1 Add Owned/Friends tabs to `tour-list-sheet.vue`, default Owned, no merged list
- [ ] 7.2 Scope `use-tour-filters` search/filter independently per tab
- [ ] 7.3 Render gated friend tours (hidden partners/date/gpx) with an owner label; for full-detail friend tours render partners from the registered-user names returned by the friend-read path (not the viewer's contacts store)
- [ ] 7.4 Add tab + owner-label i18n keys

## 8. Frontend: friend tours on the map

- [ ] 8.1 Include partner-friend tours in the map marker source alongside owned tours
- [ ] 8.2 Add friendship indicator inside friend-tour markers; keep clustering behavior
- [ ] 8.3 Ensure non-partner friend tours are excluded from the map

## 9. Tour collision handling

- [ ] 9.1 Add a 100m goal-collision detector (reuse `features/tours/domain/distance.ts`) over the client's owned + visible friend tours
- [ ] 9.2 On tour create, if the goal collides with a friend tour where the user is a partner, show a duplicate-save prompt dialog (+ i18n)
- [ ] 9.3 Confirm path: save normally (existing shared-tour create flow). Decline path: do not save, call interest dispatcher
- [ ] 9.4 Map marker layer: suppress a friend marker when it collides (within 100m) with an owned tour; keep the friend tour in the Friends list tab

## 10. Notifications: types + preferences

- [ ] 10.1 Add `tour_updates` and `tour_interest` to `NotificationType` union + `ALL_NOTIFICATION_TYPES`
- [ ] 10.2 Add `tour_updates` and `tour_interest` mute toggles to `notification-preferences-section.vue` + i18n
- [ ] 10.3 Add `notifyTourChanged(tourId, action)` and `notifyTourInterest(tourId)` dispatchers in `notify-dispatch.ts`
- [ ] 10.4 Call `notifyTourChanged` from tours-store on create/delete and on meaningful-field edits only (name, planned_date, location, tour_type, partners)

## 11. Worker: tour-changed + tour-interest endpoints

- [ ] 11.1 Add `/notify/tour-changed` route in `services/email-hook/src/index.ts` + handler in `notify.ts`
- [ ] 11.2 Resolve recipients: tour partner user IDs ∩ owner's friends, excluding the actor; verify caller is the tour owner
- [ ] 11.3 Add `/notify/tour-interest` route: notify the colliding tour's owner; authorize by verifying an accepted friendship between caller and owner AND tour `visibility='friends'` (skip collision/partner re-verification)
- [ ] 11.4 Honor `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types` (`tour_updates` / `tour_interest`) per recipient
- [ ] 11.5 Add single generic localized Brevo template per type (DE/EN), parameterized by action + actor; add template env vars to `config.ts`, the GitHub Actions env step, and document in `SETUP-NOTIFICATIONS.md`

## 12. Tests

- [ ] 12.1 Tours store: friend-tour load, gated vs full handling, meaningful-edit notification gating (edge/failure cases)
- [ ] 12.2 Collision: prompt fires only when user is a partner on the colliding tour; decline triggers interest dispatch; map dedup prefers owned
- [ ] 12.3 Notify dispatch: fire-and-forget swallows Worker failure; no dispatch when no friend partners
- [ ] 12.4 Run `npm run test` — all pass; `npm run type-check` clean

## 13. Documentation

- [ ] 13.1 Add `docs/friendships-and-tour-visibility.md` covering: the friendship concept (phone-verified users, friend_requests/friendships, block→friendship cleanup); per-tour visibility (`private` vs `friends`, default `friends`, owner-only toggle); and the authorization model for deciding what to expose — two-layer authz (row RLS = friendship + visibility; detail gating in the friend-read view), non-partner gating of partners/planned_date/gpx, registered-user partner-name resolution, GPX storage policy, and the shared-tour/interest notification flows
- [ ] 13.2 Include a diagram/flow of the read decision (own → full; friend + friends-visible → row; partner? → full vs gated; private → owner-only) and the partner-resolution chain (tour_partners → contacts → contact_methods phone → auth.users)
- [ ] 13.3 Link the new doc from `README.md` (add it under a relevant section, e.g. near "Authentication" / "Database changes")

## 14. Finalize

- [ ] 14.1 Run `npx eslint . --fix` (zero warnings) — do NOT run `npm run format`
- [ ] 14.2 Prompt user to push to prod DB (`supabase db push`) after review — do not run unprompted
- [ ] 14.3 Prompt user to commit with a ready-to-copy conventional commit message (e.g. `feat(tours): friend tour visibility and shared-tour notifications (#85)`)
- [ ] 14.4 Prompt user to push branch and open a PR to `main`
