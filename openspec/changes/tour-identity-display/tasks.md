## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/265-tour-identity-display`

## 2. Store groundwork (all additive)

- [x] 2.1 `src/features/contacts/presentation/stores/contacts-store.ts`: add `hasLoaded = ref(false)`, set it `true` in the `finally` of `loadContacts` so a **failed** load also settles, export it. This is the settle signal — `isLoading` cannot serve, it reads `false` before the first load starts (design D2)
- [x] 2.2 In `src/features/friendships/presentation/stores/friendships-store.ts`, add a `directoryCacheKey()` helper returning `friend-directory:<uid>` (null when signed out), with the cached value typed `Array<[string, string]>` — uid → E.164 entries (D4)
- [x] 2.3 Add `persistDirectory()`: serializes `userIdToPhoneMap` to entries and `void putCached(key, entries).catch(...)` — fire-and-forget, never awaited on an RPC path, debug-logged on failure. Call it at the end of `findPhonesByUserIds`, `findUsersByPhones`, and `findUserByPhone`, in each case only when that call actually added entries. Add a `ponytail:` comment noting the staleness ceiling and pointing at #273. Do NOT touch `getNamesByUserIds` — profile names are not part of this change (D4)
- [x] 2.4 Add `ensureDirectory(): Promise<void>` as a promise singleton (created once per signed-in user, awaited by N callers). `getCached`s the entries and merges **cache-loses-to-memory**: skip any id already in the map. A cache miss or read failure resolves normally — it is not an error (D4)
- [x] 2.5 Add the in-flight registry (D4a): a module-level `Map<string, Promise<void>>` keyed by uid inside `findPhonesByUserIds`. A caller for an id already in flight awaits the existing promise instead of issuing a second RPC; the entry is deleted on settle, success or failure. Without this the lookup burst scales with rows, not owners
- [x] 2.6 `clear()` resets the `ensureDirectory` singleton and the in-flight registry so the next sign-in re-hydrates. Do NOT `clearCached` the key — it is uid-namespaced and warm on re-login (D4)
- [x] 2.7 Export `ensureDirectory`. Verify no existing consumer of `userIdToPhoneMap` changed behaviour: they read a warmer map with fewer duplicate calls, nothing else

## 3. `useFriendDisplayName` composable

- [x] 3.1 Create `src/features/friendships/presentation/composables/use-friend-display-name.ts` exporting `useFriendDisplayName(userId: MaybeRefOrGetter<string | null>)` → `{ displayName: Ref<string | null>, isResolved: Ref<boolean> }` (D1)
- [x] 3.2 Create `src/features/friendships/domain/resolve-friend-name.ts` exporting the pure `resolveFriendName(userId, phoneMap, findContact) => string | null` (D3a): `phoneMap.get(userId)` → `findContact(phone)` → `resolveContactName`, `null` when any step fails or the name is empty. `findContact` is INJECTED (no runtime import of the contacts feature); `Contact` is a type-only import. No `vue-i18n` here — the caller owns the fallback string
- [x] 3.3 In the composable, call it inside a `computed` with `contactsStore.findContactByMethodValue.bind(null, 'phone')` as the injector — reuse that store method (`contacts-store.ts:348`), do NOT hand-roll the scan; it normalizes both sides, so a contact imported in local format still matches an E.164 query. `null` ⇒ `t('tours.list.aFriend')`. Do NOT read `userIdToNamesMap` — profile names are not a source in this change
- [x] 3.4 **GAP — the resolution gate.** `// TODO(me):` in the file, spec'd in "Your turn" below (D2)
- [x] 3.5 Watch `userId` (via `toValue`) with `{ immediate: true }` so a component reused for a different tour re-resolves from scratch — `isResolved` must return to `false` on id change, or the previous owner's name shows through

## 4. `tour-list-row.vue` — avatar + owner label (#265 + #269)

- [x] 4.1 Delete the `initial` computed (line 19) and the `{{ initial }}` interpolation. Render `<BaseIcon :name="tour.tourType ? TOUR_TYPE_ICONS[tour.tourType] : 'tour'" />` inside `.tour-avatar` (D6). `tour` is already in the icon registry — do NOT add an entry to `src/core/components/icons.ts`
- [x] 4.2 Bind the tint as a custom property: `:style="tour.tourType ? { '--avatar-tint': TOUR_TYPE_COLORS[tour.tourType] } : undefined"`, and in `.tour-avatar` default it — `--avatar-tint: var(--color-primary)` — then swap the two existing declarations to `background-color: color-mix(in srgb, var(--avatar-tint) 16%, transparent)` and `color: var(--avatar-tint)`. No template branch, no change to size/shape/`.friend-badge` (D6)
- [x] 4.3 Replace the `ownerLabel` computed (line 27-33) and its local `joinName` helper with `useFriendDisplayName(() => tour.isFriendTour ? tour.userId : null)`. Keep wrapping the resolved name in `t('tours.list.ownedByLabel', { name })` — that key and `tours.list.aFriend` are reused verbatim
- [x] 4.4 Template: render `<span v-if="isResolved" class="tour-owner">` for the label and `<span v-else class="tour-owner-skeleton" aria-hidden="true" />` for the placeholder, both only when the tour is a friend tour
- [x] 4.5 Skeleton styles (D5): `width: 7ch`, `min-height: 1em`, `border-radius: var(--radius-sm)`, `background: color-mix(in srgb, currentColor 10%, transparent)`, inheriting `.tour-owner`'s `font-size`/`line-height`; a 1.6s `opacity` pulse `0.5 → 0.8`, disabled under `@media (prefers-reduced-motion: reduce)`
- [x] 4.6 Check the file is still within the ~150-line component cap after the edits; if the styles push it over, that is the signal to extract the avatar, not to shrink the CSS

## 5. `tour-info-sheet.vue` — owner row (#269)

- [x] 5.1 Add the owner row to the detail sheet for `tour.isFriendTour` only, using the same `useFriendDisplayName(() => tour.isFriendTour ? tour.userId : null)` call. It is the **first** of the detail rows — before the type row at `tour-info-sheet.vue:667` — reusing the existing detail-row markup with `<BaseIcon name="person" />` (already registered)
- [x] 5.2 Same settle gate and skeleton treatment as the list row (tasks 4.4/4.5). The resolved **name** MUST be identical on both surfaces — that is the point of sharing the composable — even though the wrapper strings differ ("Created by X" in the sheet, "by X" on the row)
- [x] 5.3 New key `tours.infoSheet.createdByLabel` in BOTH `src/locales/en.json` (`"Created by {name}"`) and `src/locales/de-CH.json` (`"Erstellt von {name}"`). The unresolved case reuses the existing `tours.list.aFriend` (`"a friend"` / `"einem Freund"`) as the `{name}` value — check it reads correctly in German inside the new wrapper before adding a second fallback key. Locale files stay key-for-key identical

## 6. Search by owner name (Friends tab)

- [x] 6.1 `src/features/tours/presentation/composables/use-tour-filters.ts` — in `matchesSearch`, for `tour.isFriendTour` also test `resolveFriendName(tour.userId, friendshipsStore.userIdToPhoneMap, ...)` against the query (D3a). Import the friendships store in the composable; it does not have it today
- [x] 6.2 `test/features/tours/presentation/composables/use-tour-filters.test.ts` already exists and does not stub the friendships store — add it to that test's Pinia setup, or the whole existing suite fails on the new dependency
- [x] 6.3 A cold phone map means no owner match — do NOT make the predicate async or await anything. Add a `ponytail:` comment saying so: the rows' own resolution warms the map before a user can type

## 7. Migrate the remaining tour-related surfaces (D8)

- [x] 7.1 Add `ensurePhones(ids: string[]): Promise<void>` to the friendships store — one batched `findPhonesByUserIds` for the whole list, sharing the D4a in-flight registry. This is the batch seam the list surfaces need; each migrated surface swaps its `getNamesByUserIds(missing)` prefetch watcher for it
- [x] 7.2 `collision-notice.vue` — `nameFor` resolves via `resolveFriendName`, fallback `tours.list.aFriend`. **Delete the `t('tours.infoSheet.unnamedTour')` fallback at line 145** — it renders a tour string as a person's name. Prefetch via `ensurePhones`
- [x] 7.3 `linked-with-section.vue:58` and `link-request-banner.vue:58` — same swap; both prefetch via `ensurePhones` (lines 96 and 69)
- [x] 7.4 `backfill-collisions-page.vue:99` — same swap; prefetch at line 76 becomes `ensurePhones`
- [x] 7.5 `planned-calendar.vue` — replace the bespoke contact-wins-profile-fallback at line ~259 with `resolveFriendName`, fallback `tours.list.aFriend`; drop the `getNamesByUserIds` watcher (line 242). 
- [x] 7.6 `tour-info-sheet.vue:494` `friendPartnerNames` — contact name where `resolveFriendName` resolves, **else the existing server-resolved profile name** from `tour.partnerNames` (D8; partners are not necessarily friends, so the profile name is the only name available). Keep the `partnerSelf` ("Me") branch unchanged
- [x] 7.7 `use-tour-filters.ts:85` `resolvePartnerNames` — same two-step for friend tours, so partner search matches what the sheet displays
- [x] 7.8 Do NOT touch `friend-requests-sheet.vue:46` — incoming requests stay profile-name (the requester is not a contact yet). Confirm `userIdToNamesMap` and `getNamesByUserIds` still have that one consumer and are therefore kept

## 8. Remove the superseded prefetch

- [x] 8.1 Delete the friend-owner name prefetch watcher at `src/features/tours/presentation/components/tour-list-sheet.vue:79-85` — nothing in the tour list reads profile names now. **Keep** the `friendshipsStore` import and `storeToRefs` line (56-57): `friendships` is still used elsewhere in the file (D7)
- [x] 8.2 Leave a `ponytail:` comment where it was, naming the ceiling and the upgrade path: per-row resolution is one lookup per distinct owner (bounded by the D4a in-flight registry); if a friends list with many distinct owners stalls on first paint, batch via `ensureDirectory(ids)` on the sheet rather than reviving a second writer

## 9. Tests (edge cases + failures only)

- [x] 9.1 New `test/features/friendships/presentation/composables/use-friend-display-name.test.ts`: (a) phone lookup settles while `contactsStore.hasLoaded` is still `false` ⇒ `isResolved` stays `false` and the `aFriend` fallback is NEVER emitted, then the contact name appears once contacts load (the cold-start flip, D2); (b) contact whose `resolveContactName` yields empty ⇒ `aFriend` fallback; (c) phone lookup rejects ⇒ `isResolved` becomes `true` with the fallback (must not hang); (d) `userId` changes to a different id ⇒ `isResolved` returns to `false` before the new name appears
- [x] 9.2 Store tests: (a) cached entry for an id already resolved in-session ⇒ the in-session value survives the hydrate (D4 merge direction); (b) `getCached` rejecting ⇒ `ensureDirectory` still resolves; (c) two concurrent `findPhonesByUserIds` calls for the same uncached id ⇒ the repository is called ONCE and both callers resolve (D4a)
- [x] 9.3 Update `test/features/tours/presentation/components/tour-list-row.test.ts` (create if absent): untyped tour ⇒ generic `tour` icon and NO `?` character in the rendered output; friend tour with unresolved owner ⇒ skeleton present and no owner text
- [x] 9.4 `test/features/tours/presentation/composables/use-tour-filters.test.ts` — Friends tab, query matching the owner's CONTACT name ⇒ the tour matches; same query against the owner's profile name (different string) ⇒ no match, proving the filter reads the same source as the display
- [x] 9.5 Migrated surfaces (D8), failure paths only: (a) `collision-notice` candidate with no resolvable contact ⇒ `aFriend` fallback and the string "Unnamed tour" appears NOWHERE as a name; (b) friend-tour partner who is NOT a friend of the viewer ⇒ the server profile name is shown, not the fallback; (c) `planned-calendar` availability row with no resolvable contact ⇒ fallback shown and the call/message actions are not offered
- [x] 9.6 Run the existing suites for every touched feature — `tour-links`, `calendar`, `friendships`, `contacts` — before assuming the migration is behaviour-neutral. Several of these components have tests asserting profile-name output that MUST be updated deliberately, not deleted
- [x] 9.7 `npm run test` — all pass

## 10. Manual verification

- [ ] 10.1 `npm run dev`: My Tours list shows type icons with per-type tint; a tour with no type shows the generic icon on the neutral tint; no `?` anywhere
- [ ] 10.2 **Blocking contrast check, both themes.** Acceptance: for `skiing` (`#1565C0`), `hiking` (`#DC2626`), and `paragliding` (`#D97706`) the icon is legible against the avatar circle AND `.friend-badge` stays distinguishable over it, on light AND dark. If dark fails, add a per-theme `--avatar-tint-mix` in `tokens.css` (16% light / ~28% dark) and use it in the `color-mix` — do NOT edit `TOUR_TYPE_COLORS`, they are shared with the map markers and the calendar (D6)
- [ ] 10.3 Friends tab with a friend saved in contacts under a different name than their profile: the contact name shows, and — throttle the network in devtools to make the window visible — "by a friend" NEVER flashes first
- [ ] 10.4 Open that tour's detail: the owner row shows the identical string as the row
- [ ] 10.5 Reload with the network offline (after one online load): friend tours still name their owners — cached phone map resolved against the cached contacts
- [ ] 10.6 Fresh profile / cold cache offline: the skeleton settles to "by a friend" rather than shimmering forever (the failure path in D2)
- [ ] 10.7 Devtools network panel on a cold Friends tab with several tours sharing one owner: exactly ONE `find_phones_by_user_ids` call per distinct owner (D4a)
- [ ] 10.8 Walk every migrated surface for ONE friend saved under a non-profile name — collision notice, linked-with pills, link-request banner, backfill page, calendar availability chip, friend-tour partner list — and confirm they all say the SAME name (D8)
- [ ] 10.9 Incoming friend request from a non-contact still shows the requester's PROFILE name, and accepting still auto-creates the contact (`maybeCreateContactForFriend` untouched)

## 11. Finalize

- [x] 11.1 `npx eslint . --fix` — zero warnings
- [x] 11.2 `npm run type-check` — clean
- [ ] 11.3 Prompt user to commit (do NOT commit). Suggested split into three atomic commits: `feat(tours): activity-type avatars in tour list (#265)` / `feat(tours): name friend-tour owners by contact name (#269)` / `refactor(friendships): resolve friends by contact name across tour surfaces`
- [ ] 11.4 Prompt user to push the branch and open a PR to `main`, closing both #265 and #269
