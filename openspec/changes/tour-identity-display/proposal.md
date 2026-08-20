## Why

Two user-feedback issues about the same thing: a tour row / tour detail does not say
what kind of tour it is, or whose it is.

**#265** — `tour-list-row.vue:19` builds a 40px circle from
`props.tour.name?.[0]?.toUpperCase() ?? '?'`. The letter carries no information the
row's own title doesn't already carry (it *is* the title's first character), and an
unnamed tour renders a literal `?`. Meanwhile the tour's activity type — the one field
that makes a list scannable — is already iconified and colored everywhere else in the
app (`day-preview.vue:27`, `seasons-gantt.vue:97`, `planned-calendar.vue:445`,
`tour-info-sheet.vue:667` all read `TOUR_TYPE_ICONS`; the map markers read
`TOUR_TYPE_COLORS`). The tour list is the only surface still speaking in initials.

**#269** — opening a friend's tour shows no owner at all. `tour-info-sheet.vue` has no
owner display; the only attribution anywhere is the list row's `ownedByLabel`
(`tour-list-row.vue:30`), which resolves the owner strictly through
`friendshipsStore.userIdToNamesMap` — the friend's *own profile* name. So a friend the
user has saved as "Mum" is announced by whatever they typed into their profile, and
when the profile lookup hasn't landed the row falls back to "by a friend". The user's
own address book — the name they actually think in — is never consulted.

A friendship is always linked to a contact, and the database enforces it: a request can
only be sent from a contact (`connect-prompt.vue:46`), accepting one auto-creates a
contact seeded from the requester's profile (`friend-requests-sheet.vue:83`), and deleting
a contact terminates the friendship (`trg_cleanup_on_contact_delete`, migration
`20260519185500`). So the contact name is not a preference over the profile name — it is
the name every friend is guaranteed to have. The profile name is not a fallback worth
keeping; the one state where the link is broken is a bug tracked in **#273** (verified
phone number changed), not a display case to design around.

The two fit in one change because they are the same twenty lines of the same component,
and shipping them apart means touching `tour-list-row.vue`'s template and styles twice.

## What Changes

### #265 — activity-type avatar

- **`tour-list-row.vue`'s letter avatar becomes a type icon**: `TOUR_TYPE_ICONS[tourType]`
  rendered through `<BaseIcon>`, tinted with `TOUR_TYPE_COLORS[tourType]` (icon in the
  full color, circle in a low-alpha `color-mix` of it) — the same pairing the calendar
  and the map markers already use.
- **Null `tourType`** (the column is nullable, `tour.ts:15`) renders the already-registered
  generic `tour` icon on the neutral `--color-primary` tint the avatar uses today. No new
  icon enters `core/components/icons.ts`.
- The `initial` computed is deleted. The `friend-badge` overlay on the avatar is untouched.
- **Out of scope:** the letter avatars in `contacts-list-sheet.vue:515` and
  `user-profile-sheet.vue:250`. Those stand for *people*, who have no activity type.

### #269 — contact-first owner attribution

- **A shared `useFriendDisplayName(userId)` composable** (`features/friendships/presentation/composables/`)
  resolves one user id to one display string: the **saved contact name** —
  `resolveContactName` of `contactsStore.findContactByMethodValue('phone', phone)` for the
  phone at `friendshipsStore.userIdToPhoneMap.get(userId)`. The existing
  `tours.list.aFriend` string is kept as the last resort for the one state where no contact
  resolves — the broken link of **#273** — so the owner line always renders something.
  Profile names (`userIdToNamesMap`) are **not** consulted.
- **`tour-info-sheet.vue` gains an owner row** for friend tours (`isFriendTour`), which it
  has never had.
- **`tour-list-row.vue`'s `ownerLabel` switches to the composable**, so the list and the
  detail of the same tour never disagree about who owns it.
- **No flip, no flicker.** The name is rendered exactly once, in its final form. Until the
  phone lookup and the contacts load have both settled, the slot holds a fixed-width
  skeleton bar tuned to blend into the surrounding surface rather than announce itself as a
  placeholder. A name is never rendered and then replaced.
- **The user-id → phone map becomes offline-durable.** `userIdToPhoneMap` is today
  in-memory only and RPC-fed, so offline (and during the reconnect gap) every friend tour
  degrades to "by a friend" even though the contact holding the name is itself cached. It
  gets written through to the offline entity cache under a per-user `friend-directory:<uid>`
  key and hydrated before resolution settles. The **name** needs no caching of its own — it
  comes from the already-cached contacts collection.
- **Owner name becomes searchable** on the Friends tab. The change makes the owner visible
  on every row, so leaving `matchesSearch` (`use-tour-filters.ts:97`) covering only tour
  name + partner names would ship a visible field that finds nothing. Resolution moves into
  a pure `resolveFriendName` that both the composable and the filter call.

### One naming scheme across every tour-related surface

The same person is currently named two ways depending on the screen. Every tour-related
surface that names a **friend** moves to the contact name:

| Surface | Today | After |
|---|---|---|
| Friend-tour row + detail owner (#269) | profile / none | contact |
| Friends-tab search | not searched | contact |
| `collision-notice.vue:144` | profile, falling back to *"Unnamed tour"* for a person | contact |
| `linked-with-section.vue:58` | profile | contact |
| `link-request-banner.vue:58` | profile | contact |
| `backfill-collisions-page.vue:99` | profile | contact |
| `planned-calendar.vue:259` availability chips | contact, profile fallback | contact (shared resolver) |
| Friend-tour **partners** (`tour-info-sheet.vue:494`, `use-tour-filters.ts:85`) | profile | contact, **profile fallback retained** |
| Incoming friend requests (`friend-requests-sheet.vue:46`) | profile | **unchanged — profile** |

Two deliberate exceptions:

- **Incoming friend requests** stay profile-name: the requester is not a contact yet. That
  is the case `maybeCreateContactForFriend` resolves *after* acceptance.
- **Tour partners keep the profile name as a fallback**, because it is a data limit, not a
  preference. A friend tour's partners are the *owner's* partners and need not be friends
  of the viewer; `find_phones_by_user_ids` is friendship-gated, so for an unconnected
  partner no phone — and therefore no contact match — is obtainable at all. The
  server-resolved name in `tour.partnerNames` is the only name that exists for them.

`planned-calendar.vue` already resolves contact-first with a profile fallback; its bespoke
logic is replaced by the shared resolver rather than given new behaviour.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities

- `tour-list-view`: a tour row is identified by its activity type, not by the first letter
  of its name.
- `friend-tour-visibility`: a friend tour's owner is named on both the list row and the
  detail sheet by the viewer's own saved contact name, and is rendered only once it is final;
  partners prefer the contact name where one is obtainable.
- `tour-linking`: collision notices, linked-with pills, the link-request banner, and the
  backfill collisions page name friends by contact name.
- `calendar-availability`: friend availability chips resolve their names through the shared
  resolver instead of per-component logic.
- `offline-data-cache`: the user id → phone lookup is a cached collection, so friend
  attribution survives offline and the reconnect gap.

## Impact

- **Modified:** `src/features/tours/presentation/components/tour-list-row.vue` (avatar +
  owner label), `src/features/tours/presentation/components/tour-info-sheet.vue` (new owner
  row), `src/features/friendships/presentation/stores/friendships-store.ts` (phone-map cache
  write-through + hydrate + an `ensureDirectory` seam + an in-flight lookup registry),
  `src/features/contacts/presentation/stores/contacts-store.ts` (a `hasLoaded` flag),
  `src/features/tours/presentation/composables/use-tour-filters.ts` (owner in `matchesSearch`).
- **Added:** `src/features/friendships/presentation/composables/use-friend-display-name.ts`,
  `src/features/friendships/domain/resolve-friend-name.ts`.
- **Migrated to the shared resolver:** `collision-notice.vue`, `linked-with-section.vue`,
  `link-request-banner.vue`, `backfill-collisions-page.vue`, `planned-calendar.vue`, and the
  partner lists in `tour-info-sheet.vue` + `use-tour-filters.ts`. Each currently owns a
  `getNamesByUserIds` prefetch watcher; those become phone prefetches through one batch seam.
- **Possibly removed:** the friend-owner prefetch watcher at `tour-list-sheet.vue:80-85`
  becomes redundant once the composable owns resolution — delete it rather than leave two
  code paths racing for the same map.
- **Untouched by design:** `friend-requests-sheet.vue` keeps `userIdToNamesMap`, so
  `getNamesByUserIds` and the names map stay in the store.
- **Locales:** one new key pair for the detail-sheet owner row in `src/locales/en.json` and
  `src/locales/de-CH.json`. `tours.list.ownedByLabel` and `tours.list.aFriend` are reused
  verbatim. Both locale files stay key-for-key identical.
- **Tests:** new unit tests for the composable (contact resolution, unresolvable state,
  unsettled state, id change) and updated `tour-list-row` component tests. Failure/edge
  paths only.
- **No DB change, no migration, no RPC change, no Worker change, no new dependency.**
  `find_phones_by_user_ids` already exists and is already called; this change only calls it
  for one more reason and remembers the answer across reloads.
- **Depends on the invariant tracked in #273.** Contact-name-only resolution is correct
  exactly as long as every friendship resolves to a contact. #273 is the one state where it
  does not; until it is fixed, those owners render the generic fallback.
- **Offline cache schema:** one additional key in the existing `ENTITY_STORE`. No
  `onupgradeneeded` bump — the store is key→value and takes new keys without migration.
