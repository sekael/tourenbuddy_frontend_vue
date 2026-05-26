# Manual Test Plan — Friend Tour Visibility & Shared-Tour Notifications (#85)

Pre-production verification for the `friend-tour-visibility` change. Run the full
plan against a **staging** stack (real Supabase + Worker + Brevo) before `db push`
to prod; the DB-only sections can also be exercised locally.

> **Goal:** prove that a tour is visible to exactly the right people, with exactly
> the right detail, and that every transition (private↔friends, friend add/remove,
> partner add/remove) flips access immediately and completely.

---

## 0. Test bed & setup

### Seed actors (local stack, `supabase/seed.sql`)

| User    | UUID prefix | Phone (verified) | Relationships |
| ------- | ----------- | ---------------- | ------------- |
| Patrick | `1111…`     | `41790000001`    | friend of Jakob, friend of Selim |
| Jakob   | `2222…`     | `41790000002`    | friend of Patrick |
| Reni    | `3333…`     | `41790000003`    | **pending** request → Patrick (NOT a friend) |
| Selim   | `4444…`     | `41790000004`    | friend of Patrick; outgoing pending → Anna; incoming pending ← Reni |
| Anna    | `5555…`     | `41790000005`    | no friendship |

Seed tours owned by **Patrick**:
- **Büelehora** — solo, no partners (`friends`-visible).
- **Gfroren Hora** — partner = **Jakob** (`friends`-visible).

### Sign-in (local)
- App uses email + OTP. Seed emails: `<name>@tourenbuddy.ch`. OTP lands in **Inbucket** at http://127.0.0.1:54324.
- Use **two browser profiles / one incognito** so two users are signed in simultaneously.
- For notification tests, follow `services/email-hook/SETUP-NOTIFICATIONS.md` (push needs Chrome/Edge; email needs a real Brevo key).

### Reset between destructive runs
`supabase db reset` restores the seed. Re-run after any test that deletes friendships/tours if you want a clean slate.

### Legend
- **Owner** = signed in as Patrick. **Partner-friend** = Jakob. **Non-partner friend** = Selim. **Non-friend** = Anna. **Pending-only** = Reni.

---

## 1. Visibility basics

- [ ] **1.1 Default is `friends`.** Owner creates a new tour without touching visibility → in DB `visibility = 'friends'`; a friend can see it (§2.1).
- [ ] **1.2 Owner sets private (info sheet).** Open a `friends` tour as owner → toggle reads **"Make tour private"** (lock icon). Tap → button now reads **"Make visible to friends"** (group icon). DB `visibility='private'`.
- [ ] **1.3 Owner sets private (create form).** Create a tour with visibility = Private in the form → persisted private; no friend can see it.
- [ ] **1.4 Back to friends.** Toggle a private tour back → button label flips, `visibility='friends'`, friend can see it again (§2.1).
- [ ] **1.5 Toggle is owner-only.** As a friend viewing the owner's tour, **no** visibility toggle is shown.
- [ ] **1.6 Edit never resets visibility.** Set a tour private, then edit an unrelated field (name) and save → still private. Set friends, edit → still friends.

## 2. Friend read authorization (row access)

- [ ] **2.1 Friend sees friends-visible tour.** Jakob's Friends tab + map show Büelehora and Gfroren Hora (owned by Patrick).
- [ ] **2.2 Non-friend sees nothing.** Anna's Friends tab is empty; no Patrick markers on her map.
- [ ] **2.3 Pending request is NOT a friendship.** Reni (pending → Patrick, not accepted) sees **none** of Patrick's tours.
- [ ] **2.4 Private hidden from everyone — including a partner.** Patrick sets Gfroren Hora private. Jakob (the marked partner) no longer sees it in list or map. Patrick still sees it.
- [ ] **2.5 Self always full.** Patrick always sees both tours with full detail regardless of visibility.

## 3. Detail gating (partner vs non-partner friend)

- [ ] **3.1 Partner sees full detail.** Jakob opens Gfroren Hora → sees **planned date**, **GPX download**, **attachments**, and **partner names**.
- [ ] **3.2 Non-partner sees gated detail.** Selim opens Büelehora (he's a friend, not a partner) → **no** planned date, **no** GPX, **no** attachments, **no** partner names; name / location / type / elevation still shown.
- [ ] **3.3 Raw contact IDs never leak.** (DB) `select * from friend_tours_view` as any friend never returns a `partner_ids` column / owner contact UUIDs.
- [ ] **3.4 Gating is per-tour, per-viewer.** Jakob is a partner on Gfroren Hora (full) but only a plain friend on Büelehora (gated) — confirm both in one session.

## 4. Partner resolution edge cases

- [ ] **4.1 Partner via verified phone.** Add Jakob as partner (contact phone `+41790000002`) → Jakob resolves as partner (full detail). Confirm `+` and non-`+` forms both resolve.
- [ ] **4.2 Partner contact with NO phone.** Mark a contact that has no phone method as partner → that person is **not** resolved; if it's the only partner, a friend viewing sees gated.
- [ ] **4.3 Partner whose phone is unverified.** A partner contact whose phone matches a user **without** `phone_confirmed_at` → not resolved as partner.
- [ ] **4.4 Co-partner you don't know is still shown.** On a tour with two partners (e.g. Jakob + Reni), Jakob (partner) sees **both** names even though Jakob and Reni aren't friends.
- [ ] **4.5 Self shows as "Me".** Jakob viewing a tour he partners on sees his own entry as **"Me" / "Ich"**, not "Jakob Tester".
- [ ] **4.6 Removing the partner phone downgrades.** Remove the matching phone from the partner contact → on next read the friend is gated (planned date / GPX / attachments / names disappear).

## 5. GPX & attachment sharing

- [ ] **5.1 Partner downloads GPX.** Owner uploads a GPX to Gfroren Hora. Jakob (partner) sees the **GPX download** button and the **track renders on the map**; download succeeds.
- [ ] **5.2 Partner sees attachments.** Owner adds image/PDF attachments. Jakob sees thumbnails and can open the viewer.
- [ ] **5.3 Non-partner blocked.** Selim (friend, non-partner) sees neither GPX nor attachments on a tour he's not a partner on.
- [ ] **5.4 Private blocks files.** Set the tour private → even Jakob (former partner) can no longer fetch GPX/attachments (network 4xx on the object), not just hidden in UI.
- [ ] **5.5 Non-friend fully blocked.** Anna gets no rows and cannot fetch any object.

## 6. Map markers

- [ ] **6.1 All readable friend tours appear.** As Jakob: **both** Büelehora (non-partner) and Gfroren Hora (partner) show friend markers — not only the partner one.
- [ ] **6.2 Friend marker styling.** Friend marker shows the two-person glyph tinted a **lighter shade** of the tour-type colour, centred and filling the circle.
- [ ] **6.3 Completion check on top.** Mark a friend tour completed (as owner) → viewing as friend, the white check renders **above** the friend glyph and stays legible.
- [ ] **6.4 Collision dedup (owned wins).** Create an owned tour within 100m of a friend tour → only the owned marker renders on the map; the friend tour still appears in the Friends list.
- [ ] **6.5 Clustering.** Friend + owned markers cluster together normally; expanding a cluster shows both.
- [ ] **6.6 Markers load at bootstrap.** Cold sign-in, open the map **without** visiting the Friends tab first → friend markers are already present.

## 7. List: Owned / Friends tabs

- [ ] **7.1 Default Owned.** Opening the list first time shows the Owned tab with only the user's tours.
- [ ] **7.2 Friends tab content.** Friends tab lists all readable friend tours, each labelled "von <owner>" ("by a friend" if name unresolved). Partner tours show partner subtitle; gated tours show no "Limited info" text.
- [ ] **7.3 Independent search/filter.** Search/filter on Owned does not affect Friends and vice-versa; switching tabs preserves each tab's own query.
- [ ] **7.4 Tab persists across detail nav.** From the **Friends** tab, open a tour → back → you land back on **Friends** (not Owned). Repeat from Owned.

## 8. Collision & duplicate-save prompt

- [ ] **8.1 Partner-collision prompts.** Jakob creates a tour within 100m of Gfroren Hora (he's a partner) → duplicate dialog appears, naming the owner.
- [ ] **8.2 Confirm saves + notifies.** Confirm → Jakob's own tour is created; Patrick receives a `tour_updates` "created" notification (Jakob marked as partner).
- [ ] **8.3 Decline sends interest.** Decline → nothing saved; Patrick receives a **`tour_interest`** notification naming Jakob.
- [ ] **8.4 Cancel aborts silently.** Cancel → nothing saved, no notification.
- [ ] **8.5 Non-partner collision does NOT prompt.** Selim creates a tour within 100m of Büelehora (not a partner) → no dialog; normal create.

## 9. Notifications

- [ ] **9.1 Create.** Owner creates a `friends` tour with a friend-partner → that partner is notified ("created"). Actor (owner) is never self-notified.
- [ ] **9.2 Meaningful edit.** Change name / planned date / goal / tour type / partners / GPX / description / equipment, or flip completion → partner notified ("updated").
- [ ] **9.3 Cosmetic edit is silent.** Change only notes / elevation / seasons / start-end detail → **no** notification.
- [ ] **9.4 Private never notifies.** Editing a `private` tour, or switching a tour to private, sends **no** notification.
- [ ] **9.5 Delete.** Delete a shared tour → partner notified ("deleted"). (Known limit: best-effort; fires pre-delete.)
- [ ] **9.6 Only friend-partners, minus actor.** A partner who is NOT a friend of the owner is not notified; the acting owner is excluded.
- [ ] **9.7 Prefs honored.** Recipient with push off / email off / `tour_updates` muted gets nothing; Worker still returns 200.
- [ ] **9.8 Interest prefs.** Recipient who muted `tour_interest` gets no interest ping.
- [ ] **9.9 Worker offline.** Kill the Worker → tour create/edit/delete still succeed (fire-and-forget); only a console warning.

## 10. Friendship lifecycle (the watertight bit)

- [ ] **10.1 Remove friend revokes everything.** Patrick and Jakob are friends; Jakob sees Gfroren Hora (full). Remove the friendship → Jakob immediately loses list rows, map markers, GPX, and attachments for **all** Patrick tours. (Re-query / refresh; realtime for friend tours is deferred.)
- [ ] **10.2 Re-add friend restores access.** Send + accept a new friend request between them → Jakob regains full access to the tours he partners on, gated access to the rest.
- [ ] **10.3 Block revokes.** Block instead of plain remove → same revocation as 10.1, and pending requests are cleared.
- [ ] **10.4 Pending ≠ access.** While a request is only pending (Reni → Patrick), Reni has zero access; only after acceptance does access appear.
- [ ] **10.5 Direction-agnostic.** Verify access works regardless of who sent the original request (friendship edge matches either column).

## 11. Visibility transitions interplay

- [ ] **11.1 friends→private→friends round-trip.** A friend's view appears, disappears, reappears in lockstep with the toggle, including GPX/attachments.
- [ ] **11.2 Private + partner.** Confirm a private tour is hidden from its marked partner (re-assert 2.4 after toggling several times).
- [ ] **11.3 Partner add after share.** Add a friend as a partner on an already-shared tour → that friend upgrades from gated to full on next read.

## 12. Security / negative (DB & API level)

Run as the relevant user's JWT (the RLS script `supabase/tests/friend_tour_visibility_rls.sql` covers the core cases; spot-check these manually too):

- [ ] **12.1 Non-friend → friend_tours_view = 0 rows.**
- [ ] **12.2 `tour_partner_names('<tour>')` returns nothing** for a non-partner / non-friend / unauthenticated caller.
- [ ] **12.3 Stranger cannot fetch GPX/attachment objects** even with a guessed path.
- [ ] **12.4 Non-owner cannot change visibility** (RLS rejects the update).
- [ ] **12.5 Invalid visibility value rejected** by the check constraint.
- [ ] **12.6 Friend cannot edit/delete the owner's tour** (read-only).

## 13. Regression — owner & existing features

- [ ] **13.1 Owner unaffected.** All owner-side tour CRUD, GPX, attachments, partners (address-book chips), group SMS work exactly as before.
- [ ] **13.2 No leakage into Owned tab.** Friend tours never appear in the Owned tab or owner counts.
- [ ] **13.3 i18n.** Switch locale DE↔EN; all new strings (visibility toggle, tabs, "Me"/"Ich", notifications) localise.

---

## Sign-off

| Area | Tester | Date | Result |
| ---- | ------ | ---- | ------ |
| 1–3 Visibility & gating | | | |
| 4–5 Partner resolution & files | | | |
| 6–8 Map / list / collision | | | |
| 9 Notifications | | | |
| 10–11 Friendship & transitions | | | |
| 12–13 Security & regression | | | |

**Deploy gate:** all of §2, §3, §5, §10, §12 must pass (these are the data-exposure-critical paths). A failure in any of them blocks `supabase db push` to prod.
