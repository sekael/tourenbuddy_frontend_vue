## ADDED Requirements

### Requirement: Realtime presence channel

The system SHALL connect every authenticated, phone-verified user with at least one accepted friendship to a single shared Supabase Realtime channel named `presence:friend-cursors` via a Yjs `SupabaseProvider` from `@supabase-labs/y-supabase`, with Yjs Awareness enabled and Yjs document persistence DISABLED. The provider SHALL be created lazily on first activation and SHALL be destroyed on sign-out, on loss of the last friendship, or on map unmount.

#### Scenario: Activation gates met

- **WHEN** the user is authenticated AND `phone_confirmed_at` is set AND `friendUserIds.size > 0` AND the map component is mounted
- **THEN** the system SHALL connect to the `presence:friend-cursors` channel with awareness enabled

#### Scenario: Caller phone unverified

- **WHEN** the user is authenticated but `phone_confirmed_at` is null
- **THEN** the system SHALL NOT subscribe to the channel and SHALL NOT broadcast any awareness state

#### Scenario: No friends

- **WHEN** the user is authenticated and phone-verified but has zero accepted friendships
- **THEN** the system SHALL NOT subscribe to the channel and SHALL NOT broadcast any awareness state

#### Scenario: Sign-out tears down provider

- **WHEN** the auth store transitions to unauthenticated
- **THEN** the system SHALL destroy the Yjs provider, drop its awareness state, and remove all friend-cursor render layers from the map

#### Scenario: Map unmount tears down provider

- **WHEN** the map component is unmounted (route change, app teardown)
- **THEN** the system SHALL destroy the Yjs provider and clear local awareness

### Requirement: Local cursor capture and broadcast

The local client SHALL listen to `pointermove` events on the MapLibre canvas, SHALL convert each event to WGS84 lon/lat via `map.unproject`, and SHALL throttle broadcasts to no more than 20 emissions per second (one emission per 50 ms minimum interval, trailing edge). The client SHALL only emit when `pointerType === 'mouse'`. The client SHALL set its awareness `cursor` field to `null` when the pointer leaves the map canvas, and SHALL also set it to `null` after 30 seconds of pointer inactivity.

#### Scenario: Mouse moves over map

- **WHEN** the user moves a mouse pointer across the map canvas
- **THEN** the system SHALL emit awareness updates carrying `{ lon, lat, t }` at most every 50 ms

#### Scenario: Touch input is ignored for emission

- **WHEN** the user interacts with the map via a touch device
- **THEN** the system SHALL NOT emit any cursor awareness state from this client

#### Scenario: Pointer leaves canvas

- **WHEN** the mouse pointer leaves the map canvas
- **THEN** the system SHALL set the local `cursor` awareness field to `null` so peers stop rendering this user's cursor

#### Scenario: Idle timeout

- **WHEN** no `pointermove` event has fired for 30 seconds while the cursor was previously broadcast
- **THEN** the system SHALL set the local `cursor` awareness field to `null`

### Requirement: Awareness state schema

The local client SHALL set two awareness fields:

- `user`: an object containing `id` (the caller's `auth.uid()`), `name` (display name string, max 64 chars), and `color` (a 7-character hex string `#rrggbb` taken from the presence palette).
- `cursor`: either `null`, or an object containing `lon` (number, -180..180), `lat` (number, -90..90), and `t` (a millisecond Unix timestamp).

Incoming awareness states SHALL be parsed against this schema. States that fail validation SHALL be discarded and SHALL NOT be rendered, with a debug-level log entry recording the invalid clientId.

#### Scenario: Local user broadcasts identity

- **WHEN** the provider connects
- **THEN** the local client SHALL set its `user` awareness field with `{ id, name, color }` before any cursor field is emitted

#### Scenario: Malformed peer state ignored

- **WHEN** an incoming awareness state fails Zod validation (missing fields, out-of-range coordinates, non-string id)
- **THEN** the state SHALL be discarded, no cursor SHALL be rendered for that peer, and a debug log SHALL record the rejection

### Requirement: Friend-only client-side filter

The system SHALL only render cursors of remote peers whose `user.id` field is present in `useFriendshipsStore().friendUserIds` AT THE TIME OF RENDER. The system SHALL never render the local user's own cursor among the friend cursors. Filtering SHALL react to friendship changes: removing a friend SHALL immediately hide that user's cursor, and accepting a new friend SHALL allow their cursor to appear without any reconnect.

#### Scenario: Non-friend peer is hidden

- **WHEN** a peer broadcasts a valid awareness state with a `user.id` that is NOT in the local `friendUserIds` set
- **THEN** the system SHALL NOT render any cursor for that peer

#### Scenario: Self never rendered

- **WHEN** a peer broadcasts an awareness state whose `user.id` equals the local `auth.uid()`
- **THEN** the system SHALL NOT render that cursor

#### Scenario: Friend removed mid-session

- **WHEN** a friendship is removed and that user's awareness state is currently rendered
- **THEN** the system SHALL remove that user's cursor from the map within one render frame

#### Scenario: New friendship reveals existing cursor

- **WHEN** the local user accepts a friend request from someone whose awareness state is already on the channel
- **THEN** the system SHALL render that user's cursor without requiring a reconnection or page reload

### Requirement: Stable per-friend color assignment

Each friend SHALL be assigned a color from a fixed 12-entry palette `PRESENCE_PALETTE` defined in `presence/data/presence-palette.ts`. The assignment SHALL be `palette[ fnv1a(userId) mod 12 ]`. The local user's own color SHALL be computed by the same formula and broadcast as part of the local `user.color` awareness field. When rendering a peer cursor, the rendered color SHALL prefer the peer's broadcast `user.color` value if it is a valid hex string in the palette, falling back to the locally computed value when the peer has not yet sent identity.

#### Scenario: Same friend, two devices, same color

- **WHEN** the local user views their friend Alice from two different devices and sessions
- **THEN** Alice's cursor SHALL render in the same hex color on both devices

#### Scenario: Two different friends, different colors (when palette permits)

- **WHEN** the local user has up to 12 friends online and palette indices do not collide
- **THEN** every friend's cursor SHALL render in a distinct color

#### Scenario: Palette accessibility

- **WHEN** the palette is rendered against either Swisstopo `base` or `classic` map styles
- **THEN** every palette color SHALL achieve at least 3:1 contrast ratio against typical map background pixels, augmented with a 1-pixel white outline on each cursor dot

### Requirement: Cursor rendering on the map

Friend cursors SHALL render on top of the existing tour markers and GPX layers. The rendering SHALL use a single MapLibre GeoJSON source `presence-cursors` shared by two layers: a `circle` layer for the colored dot (radius 6 px, white 1 px outline) and a `symbol` layer for the friend's display name (text offset above the dot, 12 px sans-serif). The source SHALL be updated in place (`source.setData`) when the friend-cursors collection changes.

When the map style changes (style swap), the system SHALL re-add the source and both layers after `style.load`.

When a peer's position update arrives, the rendered cursor SHALL animate smoothly from its previous lon/lat to the new lon/lat over no more than 100 ms.

#### Scenario: Cursor appears on first peer broadcast

- **WHEN** a friend peer first publishes a non-null `cursor` awareness state and is in the friend filter
- **THEN** a colored dot with the friend's display name label SHALL appear at that lon/lat on the map

#### Scenario: Cursor disappears on peer disconnect

- **WHEN** a friend peer disconnects (browser close, navigation away, network drop) and Awareness fires its standard timeout
- **THEN** the corresponding cursor SHALL be removed from the map within the Awareness timeout window (no manual cleanup required by application code)

#### Scenario: Cursor disappears on cursor-null

- **WHEN** a friend peer broadcasts a `cursor: null` awareness update
- **THEN** the corresponding cursor SHALL be removed from the map within one render frame

#### Scenario: Map style swap re-attaches layer

- **WHEN** the user toggles between Swisstopo `base` and `classic` styles
- **THEN** all currently active friend cursors SHALL re-render after the new style finishes loading, without losing identity or color

### Requirement: Module isolation

All presence-feature code SHALL live under `src/features/presence/`. Existing feature modules (`map`, `tours`, `contacts`, `friendships`, `auth`, `user`) SHALL NOT be modified beyond ONE addition: a single `<friend-cursors-layer :map="map" />` mount line and its corresponding `import` statement in `src/features/map/presentation/components/tourenbuddy-map.vue`. No store, repository, schema, or composable inside other feature modules SHALL be edited.

#### Scenario: Map component change is minimal

- **WHEN** reviewing the diff against `tourenbuddy-map.vue`
- **THEN** the diff SHALL contain only one new import line and one new template element; no other lines SHALL be modified

#### Scenario: No cross-module mutation

- **WHEN** reviewing the full PR diff
- **THEN** no file outside `src/features/presence/`, `test/features/presence/`, the locale files, the lockfile/package.json, and the single map-component edit SHALL be modified

### Requirement: Privacy boundary documented

The presence feature SHALL be documented (in `proposal.md` and `design.md`) to make explicit that:

1. The Supabase Realtime channel is shared by all subscribers, so cursor and identity broadcasts are visible to any subscriber regardless of friendship.
2. The friendship filter is enforced ONLY on the rendering client, not on the server.
3. A future iteration is expected to add channel-level authorization to enforce friendship server-side.

#### Scenario: Documentation present

- **WHEN** a reviewer reads the proposal or design document
- **THEN** the privacy boundary SHALL be explicitly described, including that broadcasts are technically observable by any channel subscriber

### Requirement: Internationalization

All user-facing strings introduced by this change SHALL be added under a `presence.*` namespace in every locale file (`en.json`, `de-CH.json`) and rendered via `useI18n({ useScope: 'global' })`. Required keys include at minimum: `presence.cursor.ariaLabel` (parameterized by friend display name), `presence.cursor.label` (the on-map text label, typically the display name truncated). The `npm run check:locales` script SHALL pass with the new keys present in every locale.

#### Scenario: Missing locale key fails CI

- **WHEN** a string is added to one locale but not another
- **THEN** the locale parity check SHALL fail and the change SHALL NOT merge

#### Scenario: Cursor accessibility label

- **WHEN** assistive tech inspects a rendered friend cursor element
- **THEN** the element SHALL expose `aria-label` translated via `presence.cursor.ariaLabel` with the friend's display name interpolated
