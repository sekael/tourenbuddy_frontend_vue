## Context

`tour-list-row.vue` is 150 lines and already imports both the contacts store and the
friendships store: it resolves partner names through `contactsStore.contacts` and the
friend-tour owner through `friendshipsStore.userIdToNamesMap`. So the data this change
needs is, in both halves, already in scope of the component that displays it.

**A friendship always resolves to a contact.** This is enforced, not merely conventional:

- `sendRequest` has exactly one caller, `connect-prompt.vue:46`, reached from the contacts
  UI — you can only befriend someone you have saved.
- Accepting an incoming request auto-creates the contact:
  `friend-requests-sheet.vue:83` `maybeCreateContactForFriend`, seeded from the requester's
  profile name (or their formatted phone when the profile has no first name).
- Deleting a contact terminates the friendship in the database:
  `trg_cleanup_on_contact_delete` (BEFORE DELETE on `public.contacts`, migration
  `20260519185500`) resolves the contact's phones against `auth.users.phone` and calls
  `terminate_pending_and_friendship_between`.

So the contact name is not a *preferred* name for a friend — it is the only name a friend
is guaranteed to have, and the profile name is at best a duplicate of it (the auto-created
contact is seeded from the profile). The single state where the chain breaks is a changed
verified phone number, which desynchronizes display resolution **and** the cleanup trigger:
tracked as **#273**, out of scope here.

The friendships store keeps the lookup this change leans on:

- `userIdToPhoneMap: Map<uid, e164>` — filled by `findUserByPhone`, `findUsersByPhones`,
  and `findPhonesByUserIds`, each of which dedupes (`ids.filter(id => !map.has(id))`) and
  swallows its own errors.

It is a plain `ref(new Map())`, cleared on sign-out, and — unlike `friendships`,
`incomingRequests`, `outgoingRequests` — **not** part of the `FriendshipsSnapshot` that
`cachedLoad` persists. It is a pure RPC cache with a session lifetime, which is why
`tour-list-row` today has a "not known yet" branch rendering `by a friend`.

`userIdToNamesMap` stays in the store for the five call sites this change does not touch.
Nothing here reads it.

The contacts side has the inverse map: `useContactFriendshipMap` builds
phone → userId from the user's own contacts by calling `findUsersByPhones`. It is
per-component state (`ref` inside the composable), keyed the wrong way round for this
change, and only warm on surfaces that mount it (`contacts-list-sheet`,
`contact-detail-view`). Going through `userIdToPhoneMap` instead — one uid, one RPC,
store-level cache shared by every consumer — is both cheaper and reachable from the
tours feature without importing a contacts-feature composable.

`contactsStore.findContactByMethodValue('phone', value)` (`contacts-store.ts:348`) already
does the phone → contact match, normalizing **both** sides so an imported contact stored in
local format still matches an E.164 query.

`tourType` is nullable end to end (`tour_type` column, `tourTypeSchema.nullable()`,
`TourType | null` on the entity), and `TOUR_TYPE_ICONS` / `TOUR_TYPE_COLORS` are
`Record<TourType, …>` — total over the non-null domain, undefined-yielding for `null`.

## Goals / Non-Goals

**Goals**

- A tour row states its activity type at a glance, in the same icon+color language the
  calendar and map already speak.
- A friend tour names its owner identically on the list row and in the detail sheet.
- The owner name is the name the *viewer* uses — their contact — everywhere, with no
  second naming scheme to reconcile.
- The owner name is written to the DOM exactly once. No text is ever replaced by
  different text in the same slot.
- Friend attribution works offline, since friend tours themselves already render offline.

**Non-Goals**

- No change to person avatars (contacts, profile). They keep initials.
- No change to how partners are resolved or displayed, on either owned or friend tours.
- No change to incoming friend requests (`friend-requests-sheet.vue:46`) — they stay
  profile-name, and `userIdToNamesMap` + `getNamesByUserIds` stay in the store for them.
- No new RPC, no new DB object, no change to `friend_tours_view` or its gating.
- No contact *creation* affordance from a friend tour ("save this friend to contacts").
- No repair of the friendship↔contact link when the verified phone changes — **#273**.
- No change to what non-partner gating withholds: the owner is named on gated tours too,
  as `tour-list-row` already does today. `friend_tours_view` exposes `user_id` to every
  permitted reader, and the viewer is by definition a friend of that owner.

## Decisions

### D1 — One composable, owned by the friendships feature

`useFriendDisplayName(userId: MaybeRefOrGetter<string | null>)` lands in
`src/features/friendships/presentation/composables/use-friend-display-name.ts` and
returns `{ displayName: Ref<string | null>, isResolved: Ref<boolean> }`.

- *Why a composable and not a store getter?* Resolution is asynchronous and per-consumer:
  it must fire lookups for the ids the calling component cares about and expose a settled
  flag for that component's own render gate. A store getter would be synchronous over
  possibly-cold maps — exactly the "render then flip" behaviour being removed.
- *Why in `friendships` and not `tours`?* The maps it reads are the friendships store's,
  and the concept ("what do I call this user?") is not tour-specific — the five deferred
  call sites are in `tour-links`, `friendships`, and `calendar`. Placing it under tours
  would guarantee a later move.
- *Cross-feature import check:* it imports the contacts **store** and `resolveContactName`
  from `contacts/domain/entities/contact`. Both are that feature's public surface — a
  Pinia store and a domain entity function — which `.claude/architecture.md` allows
  ("cross-feature via shared composables or Pinia store subscriptions"). It does not
  reach into contacts' repositories, schemas, or components.

### D2 — Settle-then-render, not compute-then-correct

The composable's core is a resolution gate. `isResolved` flips to `true` only once both
inputs are final for this user id:

1. `findPhonesByUserIds([uid])` has settled — resolved *or* rejected, after the cache
   hydrate of D4, and
2. the contacts collection has loaded at least once — `contactsStore.hasLoaded`.

`findPhonesByUserIds` early-returns when the id is already in the map, so a warm map
settles in a microtask and the skeleton is never seen.

- *Why gate on failure as well as success?* Otherwise offline with a cold cache (RPC
  rejects, map empty) means `isResolved` never flips and the skeleton shimmers forever.
  Settled means "no better answer is coming", not "an answer arrived".
- *Why `hasLoaded` and not `!contactsStore.isLoading`?* `isLoading` starts `false` and only
  becomes `true` once `loadContacts()` runs. On a cold start the gate would read
  "contacts settled, none present" on the first tick, resolve to the fallback, and then
  flip when contacts land — precisely the bug this design exists to prevent.
  `contacts.length === 0` cannot substitute either: an empty address book is a legitimate
  settled state, and gating on it would shimmer forever for a user with no contacts. So
  the contacts store gains `hasLoaded: Ref<boolean>`, set in the `finally` of
  `loadContacts` so a *failed* load also settles. `cachedLoad`'s hydrate path runs inside
  that same call, so an offline hydrate settles correctly too.
- *Why keep `displayName` a `computed` after settling rather than freezing a string?* A
  frozen string would go stale when the user renames the contact while the sheet is open.
  The flip risk it reintroduces is nil: after settling, the only way the inputs change for
  this uid is a deliberate local edit, and reflecting that is correct behaviour, not a
  flicker. The gate protects the *load* window, which is the whole of the problem.

### D3 — Resolution via the reverse phone map and the existing contact matcher

```
uid → userIdToPhoneMap.get(uid) → e164
    → contactsStore.findContactByMethodValue('phone', e164)
    → resolveContactName(contact)
otherwise → t('tours.list.aFriend')
```

- `findContactByMethodValue` (`contacts-store.ts:348`) is reused rather than re-scanned by
  hand: it already normalizes both sides of the comparison, so a contact imported in local
  format still matches an E.164 query — a hand-rolled `.find()` over
  `contactMethods` would silently miss those.
- A contact whose `resolveContactName` yields an empty string falls to the fallback; the
  chain is "first *non-empty*", not "first defined".
- The fallback is not a naming strategy, it is the render of a broken invariant (**#273**).
  It exists so the owner line always has content, not to name anyone well.
- *Why no profile-name rung?* Every friendship resolves to a contact by construction (see
  Context), and the auto-created contact is seeded *from* the profile name — so the rung
  would produce the same string on the happy path and only differ in the #273 state, where
  showing a stale-but-real name would mask the bug rather than surface it.

### D3a — The resolution is a pure function, so search can call it too

After this change every friend-tour row reads "by Mum", but `matchesSearch`
(`use-tour-filters.ts:97`) covers tour name + partner names only — a visible field that
finds nothing. Search is in scope, which forces the resolution out of the composable:

```ts
// features/friendships/domain/resolve-friend-name.ts
export function resolveFriendName(
  userId: string | null,
  phoneMap: Map<string, string>,
  findContact: (phone: string) => Contact | undefined,
): string | null
```

Returns `null` when unresolved; the **caller** applies the i18n fallback, so the domain
stays free of `vue-i18n`. `findContact` is injected rather than imported, so the module
takes no runtime dependency on the contacts feature — only a type-only `Contact` import.
The composable calls it inside its `computed`; `use-tour-filters` calls it synchronously
inside `matchesSearch`.

- *Why not have the filter await resolution?* A filter predicate must be synchronous. It
  reads the phone map as-is: a cold map means no owner match. Acceptable — search happens
  after paint, by which point the rows' own resolution has warmed the map, and the no-flip
  guarantee governs *rendering*, not a predicate.
- The same pure function serves every migrated surface (D8), each supplying its own
  fallback — which is why it returns `null` rather than a display string.

### D4 — The user-id → phone map becomes a cached collection

The phone map is written through to the offline entity cache after every successful RPC,
and read back once per session before resolution settles. The **name** is not cached at
all: it is derived live from the contacts collection, which the offline cache already
persists.

- **Key:** `friend-directory:<uid>` in the existing `ENTITY_STORE` — the same
  `<collection>:<uid>` namespacing every other cached collection uses, so per-account
  isolation is inherited, not re-invented.
- **Value:** `Array<[uid, e164]>` — entries rather than a `Map`: IndexedDB
  structured-clones `Map` fine, but every other value in this store is a plain array, and
  entry arrays survive a future JSON-shaped serialization step unchanged.
- **Write-through:** at the end of `findPhonesByUserIds`, `findUsersByPhones`, and
  `findUserByPhone`, i.e. wherever the map grows today, and only when entries were actually
  added. Fire and forget via `void putCached(...).catch(...)` — the cache is best-effort by
  contract and must never fail an RPC path.
- **Hydrate:** a module-level `ensureDirectory()` promise-singleton in the store, awaited
  by the composable. It runs `getCached` once, merges **without overwriting entries already
  present** (an in-session RPC answer is fresher than the cache), and resolves. Idempotent
  and safe to await from N components.
- **Merge direction matters:** cache-loses-to-memory, because the map only ever grows with
  authoritative RPC answers within a session.
- **Clear:** `clear()` (sign-out) empties the map as it does today, and resets the
  `ensureDirectory` singleton. The cached key is uid-namespaced, so it is left in place
  rather than deleted — the same treatment every other collection gets, and it makes the
  next sign-in of the same account instant.
- *Why not `cachedLoad`?* That primitive is for a collection with one fetcher and one
  assign. This is an incrementally-filled lookup table fed by three different RPCs with
  different argument sets. `getCached`/`putCached` are the right rung.
- *Privacy note:* this persists confirmed friends' phone numbers at rest. It is not a new
  class of data on the device — every friend is a contact (see Context) and the contacts
  collection, phone numbers included, is already cached by `offline-app-cache-sync`.
- *Staleness:* a cached phone that the friend has since changed resolves to the wrong
  contact or none. That is the **#273** state, and this cache widens its window from a
  session to a device lifetime. Marked `ponytail:` at the write site with a pointer to the
  issue.

### D4a — In-flight lookup registry

`findPhonesByUserIds`' existing `ids.filter(id => !map.has(id))` is a *has-landed* check,
not an in-flight one. Every current caller is single-shot (one banner, one sheet header),
so it has never mattered. Per-row resolution breaks that assumption: ten friend-tour rows
mount together, none of their lookups has landed, and each fires its own RPC — the burst
scales with the number of **rows**, not the number of distinct owners.

The store therefore keeps `Map<uid, Promise<void>>` of in-flight lookups; a caller for an
id already in flight awaits the same promise, and the entry is deleted on settle.

- *Why in the store rather than batching at the sheet?* Batching would rebuild the
  two-writer shape D7 deletes, and it does nothing for the info sheet opened directly from
  a map marker, which has no list to batch with. The registry fixes it once, at the point
  every caller routes through, and the five deferred call sites inherit it.
- *Consequence:* concurrent rows collapse to one RPC per distinct owner, which is the
  bound the risk section assumed all along.

*Alternative considered and rejected — resolve from the contact side instead.*
`find_users_by_phones(allContactPhones)` returns phone → userId in **one** call, and since
every friend is a contact it would cover every owner at once, removing this registry and
reducing the settle gate to a single promise. It is already implemented
(`useContactFriendshipMap`), and — being fed by `findUsersByPhones` — it already warms
`userIdToPhoneMap` as a side effect whenever `contacts-list-sheet` or `planned-calendar`
has mounted, so in practice the map is often warm before the tour list asks.

It is rejected on disclosure, not on cost: `find_users_by_phones` is the *discovery* RPC
and matches any registered phone, so that direction would upload the viewer's whole address
book from the tour list — a surface that sends nothing today.
`find_phones_by_user_ids` is friendship-gated and only ever asks about people the viewer is
already connected to. The registry is the price of keeping it that way.

### D5 — Skeleton that reads as surface, not as a placeholder

While `!isResolved`, both surfaces render a bar in place of the text:

- exact line box of the text it replaces (same `font-size`, `line-height`, and a
  `min-height` of `1em`) so nothing reflows when the name lands,
- fixed `width: 7ch` — roughly the width of `by Anna` — so the swap is not a visible
  resize on typical names,
- fill `color-mix(in srgb, currentColor 10%, transparent)` and `border-radius: var(--radius-sm)`:
  it derives from the slot's own color, so it blends on both themes with no new token,
- a slow, low-amplitude `opacity` pulse (`0.5 → 0.8`, 1.6s), wrapped in
  `@media (prefers-reduced-motion: reduce)` to hold it static.
- `aria-hidden="true"` on the bar, so assistive tech reads nothing rather than reading a
  decoration. The owner name is supplementary to the row's accessible name (the tour title).

*Why not "render nothing"?* Nothing means the row grows by a line when the name lands —
a reflow that is more visible on a list of ten rows than the swap it avoids.

### D6 — Avatar tint, and where the fallback lives

```
tint = tour.tourType ? TOUR_TYPE_COLORS[tour.tourType] : null
icon = tour.tourType ? TOUR_TYPE_ICONS[tour.tourType] : 'tour'
```

Bound as a CSS custom property on the element (`:style="{ '--avatar-tint': tint }"`) with
the stylesheet defaulting `--avatar-tint: var(--color-primary)`, so the null case needs no
branch in the template and the existing neutral look is what a typeless tour keeps.

- *Why `tour` as the fallback icon?* It is already in the registry
  (`core/components/icons.ts`), it is the app's own generic tour glyph, and adding an icon
  for a fallback state would be a registry entry earning nothing.
- *Why keep the low-alpha circle instead of a solid color chip?* The 16% `color-mix` fill
  with the full-strength icon is what `.tour-avatar` does today with `--color-primary`;
  reusing it means the only changed declaration is which color feeds the mix.
- *Contrast risk:* `TOUR_TYPE_COLORS` are saturated mid-tones (`#1565C0`, `#DC2626`,
  `#D97706`) chosen for map markers on a light basemap. On the dark theme a 16% mix of
  them against a dark surface is a dim circle, and the icon itself stays legible but loses
  punch. This is a real risk the tasks verify by eye in both themes; if it fails, the
  remedy is raising the mix percentage for dark via the existing theme tokens, not a new
  per-type dark palette.
- *No change to `TOUR_TYPE_COLORS` or `TOUR_TYPE_ICONS`.* Both maps are shared with the map
  markers and the calendar; editing either to suit one avatar would silently restyle three
  other surfaces.

### D7 — Delete the prefetch watcher rather than keep it

`tour-list-sheet.vue:79-85` watches `friendTours` and calls `getNamesByUserIds` for owner
ids missing from `userIdToNamesMap`. Nothing in the tour list reads profile names after
this change, so the watcher fetches data no one displays.

- The `friendshipsStore` import stays — `tour-list-sheet.vue:56-57` still uses it for
  `friendships`. Only the watcher goes.
- *Why not repoint it at phones instead?* Two writers to one settle condition is how
  flicker bugs come back, and D4a already removes the round-trip argument for batching.
  Note the ceiling in a `ponytail:` comment.

### D8 — One naming scheme, and the two places it cannot reach

Every tour-related surface that names a **friend** resolves through `resolveFriendName`.
The pure resolver returns `string | null`; each caller supplies its own fallback, which is
what lets one function serve three different fallback policies:

| Caller | Fallback when the resolver returns `null` |
|---|---|
| Friend-tour owner (row, detail, search) | `tours.list.aFriend` |
| Collision notice, linked-with, link-request banner, backfill page | `tours.list.aFriend` |
| Calendar availability chips | `tours.list.aFriend` |
| Friend-tour **partners** | the server-resolved profile name from `tour.partnerNames` |
| Incoming friend requests | *not migrated* — profile name remains the primary source |

- *Why partners keep a profile fallback.* A friend tour's partners are the **owner's**
  partners; the viewer need not be connected to them. `find_phones_by_user_ids` is
  friendship/pending-gated, so for an unconnected partner the RPC returns nothing — no
  phone, no contact match, even when that person happens to sit in the viewer's address
  book. `partner_names` exists precisely because the server can resolve what the client
  cannot. This is a data-availability limit, not a naming preference, and it does not
  reopen the owner decision: for owners a contact is guaranteed, for partners it is not.
- *Why incoming requests are exempt.* The requester is not a contact yet —
  `maybeCreateContactForFriend` creates one only *after* acceptance. There is nothing to
  resolve against.
- *`collision-notice.vue:145` currently falls back to `t('tours.infoSheet.unnamedTour')`* —
  "Unnamed tour" as a person's name. That is a pre-existing bug which the migration deletes.
- *`planned-calendar.vue:259` already resolves contact-first with a profile fallback*, via
  `useContactFriendshipMap`'s `phoneToUserIdMap` (direction B). Migrating it is a swap to
  the shared resolver, not new behaviour. **It carries an unrelated in-progress
  `// TODO(me):` gap at line 248** — the migration must not overwrite that work.

**Batch seam.** Four of the migrated surfaces name *lists* of users (collision candidates,
linked tours, availability rows, backfill pairs) and today prefetch with
`getNamesByUserIds(missing)`. Each becomes `ensurePhones(ids)` — one batched
`findPhonesByUserIds` call for the whole list, sharing D4a's in-flight registry. This is
the batch upgrade path D7 named, arriving because a list surface actually needs it rather
than on speculation.

- *Why not give every surface the settle gate + skeleton?* The no-flip guarantee exists for
  the tour owner, where a name is the row's identity. A collision notice or an availability
  chip already renders progressively today; adding gates there would be scope creep with a
  layout cost on each. They resolve reactively: `null` until the phone lands, then the name.
  Only the owner surfaces (D2) hold the strict gate.

## Risks / Trade-offs

- **One RPC per distinct owner on a cold friends tab.** With D4a the burst is bounded by
  distinct owners rather than rows. A friends list with many distinct owners still fires
  one lookup each on first paint; if that measurably stalls, the fix is a batch
  `ensureDirectory(ids)` seam, not a second writer. Measure before building it.
- **Skeleton on every cold friend-list paint.** With an empty cache and a slow free-tier
  round trip, the owner line shimmers for the RPC duration. This is the deliberate cost of
  the no-flip requirement; the offline cache (D4) removes it from the second visit onward.
- **The design leans entirely on the friendship↔contact invariant.** With no profile-name
  rung, any break in that chain renders "by a friend" instead of a name. Today the only
  known break is **#273** (changed verified phone). If a second break is discovered, the
  remedy is fixing the link, not re-adding a parallel naming scheme — that is the whole
  point of choosing one source.
- **Contact names are viewer-specific.** A contact saved as "Mum" names the owner "Mum",
  so two users looking at the same tour see different owner names. Intended, and it matches
  how the phone's own call screen behaves.
- **Type-color avatars compete with the friend badge.** The existing `.friend-badge` sits
  bottom-right on the avatar and is `--color-on-surface-variant` on `--color-surface`; on a
  strongly tinted circle it must stay distinguishable. Verified by eye, not by code.

## Migration Plan

Single-PR, forward-only, no gates:

1. Store-side groundwork — `contactsStore.hasLoaded`, the phone-map cache (write-through +
   `ensureDirectory` hydrate), and the in-flight registry (D4a). All additive; every current
   read site keeps working, against a warmer map and fewer duplicate calls.
2. The composable, with its unit tests.
3. `tour-list-row.vue` — avatar and owner label together, in one edit to one file.
4. `tour-info-sheet.vue` — the new owner row.
5. Delete the `tour-list-sheet.vue` prefetch watcher last, once nothing depends on it.

No feature flag: the change is presentational and per-render, so a rollback is a revert.
No data migration — the new cache key is written on first use and absent-means-cold.

## Open Questions

<!-- none -->
