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

- [x] 6.1 Add owner-only private/friends toggle to `tour-form.vue` (create + edit; persisted via store on submit)
- [x] 6.2 Add the same toggle (post-create) to `tour-info-sheet.vue` (owner quick-toggle → `setVisibility`)
- [x] 6.3 Add i18n keys for visibility labels/help in `en.json` and `de-CH.json`

## 7. Frontend: list Owned/Friends tabs

- [x] 7.1 Add Owned/Friends tabs to `tour-list-sheet.vue`, default Owned, no merged list
- [x] 7.2 Scope `use-tour-filters` search/filter independently per tab (namespaced persistent state per tab + source selector)
- [x] 7.3 Render gated friend tours (owner label via friendships name map, "limited info" hint) and full-detail friend tours with partners from `partnerNames` (not the viewer's contacts store)
- [x] 7.4 Add tab + owner-label + limited-info i18n keys (en + de-CH)

## 8. Frontend: friend tours on the map

- [x] 8.1 Include friend tours in the map marker source alongside owned tours (`mapTours` computed in `tourenbuddy-map.vue`; selection resolves friend tours in both map + map-page)
- [x] 8.2 Add friendship indicator inside friend-tour markers (`FRIEND_LAYER_ID` symbol layer, centered + tinted; completion check stacks above); clustering unchanged (same source/array)
- [x] 8.3 Show ALL readable friend tours on the map — partner and non-partner alike (per user follow-up; gated detail still applies when a non-partner tour is opened)

## 9. Tour collision handling

- [x] 9.1 Add a 100m goal-collision detector (`domain/collision.ts`, reuses `isSameGoal`) over visible friend tours
- [x] 9.2 On tour create, collision with a partner-friend tour shows `duplicate-tour-dialog.vue` (+ i18n); non-partner collision does not prompt
- [x] 9.3 Confirm → `performCreate` (normal flow + its notification); decline → `notifyTourInterest(collidingTour.id)`, no save; cancel → abort silently
- [x] 9.4 Map: `friendTourIdsShadowedByOwned` suppresses partner-friend markers within 100m of an owned tour; Friends list keeps them

## 10. Notifications: types + preferences

- [x] 10.1 Add `tour_updates` and `tour_interest` to `NotificationType` union + `ALL_NOTIFICATION_TYPES`
- [x] 10.2 `tour_updates`/`tour_interest` mute toggles render automatically (section iterates `ALL_NOTIFICATION_TYPES`); added `notifications.type.*` i18n (en + de-CH)
- [x] 10.3 Add `notifyTourChanged(tourId, action)` and `notifyTourInterest(tourId)` dispatchers in `notify-dispatch.ts` (generalized `postToWorker` to a JSON body)
- [x] 10.4 Call `notifyTourChanged` from tours-store on create/delete (delete fires pre-delete) + meaningful-edit gating via `isMeaningfulTourChange`/`isShareableTour` (name, planned_date, goal, tour_type, partners, gpx, description, equipment, completion flip; never on private/visibility change)

## 11. Worker: tour-changed + tour-interest endpoints

- [x] 11.1 Add `/notify/tour-changed` route in `services/email-hook/src/index.ts` + `handleTourChanged` in `notify.ts`
- [x] 11.2 Resolve recipients: `tour_partner_user_ids` RPC ∩ owner's friends, minus the actor; caller must be the tour owner; private tours notify no one
- [x] 11.3 Add `/notify/tour-interest` route + `handleTourInterest`: notify the owner; authorize by accepted friendship(caller, owner) AND `visibility='friends'`; no collision/partner re-check; rejects own-tour + non-friend
- [x] 11.4 `dispatchTourNotification` honors `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types` (`tour_updates` / `tour_interest`) per recipient
- [x] 11.5 Single generic localized Brevo template per type (4 EN/DE `tour_updates`/`tour_interest` files, action-parameterized); env vars in `config.ts` + `SETUP-NOTIFICATIONS.md` (worker secrets via `wrangler`, not GH Actions — those carry only frontend `VITE_*`). Known limit: `deleted` notification is best-effort (client fires pre-delete; Worker may 404 on the race)

## 12. Tests

- [x] 12.1 Meaningful-edit gating covered by `tour-notifications.test.ts` (cosmetic fields suppressed; date/goal/gpx/partners/description/equipment trigger; partner-set order-independence) + `isShareableTour` private/partnerless cases
- [x] 12.2 Collision covered by `collision.test.ts` (non-partner ignored, outside-radius ignored, partner-within-radius matches; owned shadows friend marker, far does not)
- [x] 12.3 Dispatch fire-and-forget is structurally guaranteed — `notifyTour*` swallow errors in `.catch`; no-recipient short-circuit is the Worker's `partnerIds ∩ friendIds` (covered by the partner/friend resolution). Store gating prevents dispatch when not shareable (12.1)
- [x] 12.4 `npm run test` — 928 pass; `npm run type-check` clean; worker `vitest` 16 pass

## 13. Documentation

- [x] 13.1 Add `docs/friendships-and-tour-visibility.md` (friendship model, per-tour visibility, two-layer authz, non-partner gating, registered-user partner names, GPX storage policy, notification flows)
- [x] 13.2 Read-decision flow diagram + partner-resolution chain (tour_partners → contacts → contact_methods phone → auth.users) included
- [x] 13.2a Predicate-location / blast-radius lesson documented (`security_invoker` rationale + `security_definer` containment-by-return-shape)
- [x] 13.3 Link the new doc from `README.md` (new "Friendships & tour visibility" section after Authentication)

## 14. Finalize

- [x] 14.1 Run `npx eslint . --fix` (zero warnings) — clean across repo
- [x] 14.2 Prompt user to push to prod DB (`supabase db push`) after review — do not run unprompted
- [x] 14.3 Prompt user to commit (message below)
- [x] 14.4 Prompt user to push branch and open a PR to `main`
