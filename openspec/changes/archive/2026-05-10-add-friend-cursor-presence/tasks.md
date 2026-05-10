## 1. Dependencies & scaffolding

- [x] 1.1 Add `@supabase-labs/y-supabase` to `dependencies` (latest 0.1.x) and bump `@supabase/supabase-js` to `^2.99` to satisfy the provider's peer range; reinstall and verify lockfile diff is minimal
- [x] 1.2 Smoke-test the build (`npm run build`) after the dependency bump to confirm no breaking changes from `@supabase/supabase-js` 2.49 → 2.99 affect the existing auth / postgrest call sites
- [x] 1.3 Create the empty feature folder skeleton: `src/features/presence/{data/{models,services},domain/{entities},presentation/{components,composables,stores}}` and the matching test mirror under `test/features/presence/`

## 2. Domain layer

- [x] 2.1 Add `src/features/presence/domain/entities/friend-cursor.ts` exporting a pure `FriendCursor` type `{ userId: string; displayName: string; color: string; lon: number; lat: number; updatedAt: number }` with no framework imports
- [x] 2.2 Add `src/features/presence/domain/entities/local-presence.ts` for the local-side `LocalPresence` type matching the awareness schema in spec

## 3. Data layer

- [x] 3.1 Create `src/features/presence/data/presence-palette.ts` exporting `PRESENCE_PALETTE: readonly string[]` (12 hex colors) and `colorForUserId(userId: string): string` using FNV-1a; include a unit test asserting determinism and palette membership
- [x] 3.2 Create `src/features/presence/data/models/awareness-schema.ts` with a Zod schema for the awareness state (`user`, `cursor`) per the spec; export inferred TS types and a `parseAwarenessState(raw: unknown): LocalPresence | null` helper that returns null on invalid input
- [x] 3.3 Create `src/features/presence/data/services/presence-channel.ts` — a thin factory `createPresenceChannel(supabase, doc, channelName)` that returns a configured `SupabaseProvider` from `@supabase-labs/y-supabase` with `awareness: true`, persistence disabled, and sensible reconnect options (`reconnectDelay: 1000`, `maxReconnectDelay: 30000`); export a `destroyPresenceChannel(provider)` helper

## 4. Presentation: store

- [x] 4.1 Create `src/features/presence/presentation/stores/presence-store.ts` (Pinia composition store `presence`) owning: a `shallowRef` for the Yjs `Doc`, a `shallowRef` for the `SupabaseProvider`, a reactive `friendCursors = ref<Map<string, FriendCursor>>` keyed by friend userId, connect/disconnect via eligibility + `attachMapSession` / `detachMapSession`, `setLocalCursor(lonLat | null)`, and `setLocalIdentity({ id, name, color })`
- [x] 4.2 In the store, watch eligibility and `mapSessionCount` (`attachMapSession` / `detachMapSession`) so the provider connects only when authenticated, phone-verified, has ≥1 friend, and the map layer is mounted (avoids disconnect stuck when leaving the map)
- [x] 4.3 In `connect()`, subscribe to `awareness.on('change', ...)`: parse each peer state via `parseAwarenessState`, drop self and non-friends, and update the `friendCursors` map (delete on null cursor)
- [x] 4.4 In `connect()`, also subscribe to friendship-set changes to retroactively prune cursors of users who are no longer friends
- [x] 4.5 On `disconnect()`, set local awareness to `null`, call `destroyPresenceChannel`, clear the cursors map, and reset both `shallowRef`s
- [x] 4.6 Unit-test the store with a fake `SupabaseProvider` (mock the `@supabase-labs/y-supabase` import) covering: activation gates, peer filtering by friendship, removal on cursor=null, removal on friendship loss, identity broadcast on connect

## 5. Presentation: composables

- [x] 5.1 Create `src/features/presence/presentation/composables/use-local-cursor-source.ts` that attaches a **trailing** throttled `pointermove` (50 ms) listener to the map canvas, ignores non-mouse pointer types, calls `map.unproject` and `presenceStore.setLocalCursor({ lon, lat })`, and clears on `pointerleave`
- [x] 5.2 Add a 30 s idle watcher in the same composable that emits `setLocalCursor(null)` when no movement has occurred for the timeout
- [x] 5.3 Compose `useUserProfileStore` to derive the local display name (fallback chain: first+last name → email local part → `"You"`) and call `presenceStore.setLocalIdentity` with `{ id, name, color: colorForUserId(id) }` whenever auth/profile changes
- [x] 5.4 Unit-test the composable: touch suppression, pointerleave clearing (throttle + idle covered by implementation; no brittle timer tests)

## 6. Presentation: rendering layer component

- [x] 6.1 Create `src/features/presence/presentation/components/friend-cursors-layer.vue` (`<script setup>`) accepting `defineProps<{ map: MapLibreMap }>()`; it MUST own its full lifecycle and add zero coupling to other features
- [x] 6.2 In `onMounted`, ensure the source `presence-cursors` (empty FeatureCollection) and two layers (`circle` for the dot, `symbol` for the label) are added to the map; subscribe to `load` and `style.load` to re-add on style swap
- [x] 6.3 Watch `presenceStore.friendCursors` and call `source.setData(...)` with a FeatureCollection of `Point` features whose `properties` carry `color` and `name`; bind the circle layer's `circle-color` to `['get','color']` and the symbol layer's `text-field` to `['get','name']`
- [x] 6.4 Implement smooth animation: on each cursor update, `requestAnimationFrame` interpolation from previous to new lon/lat over ~80 ms; cancel pending RAF on subsequent updates for the same userId
- [x] 6.5 Activate `useLocalCursorSource(() => props.map)` from this component (not from the store) so the listener is bound to the map instance lifetime
- [x] 6.6 In `onBeforeUnmount`, remove both layers, the source, and call `presenceStore.detachMapSession()` (provider lifecycle is driven by the store’s eligibility + session counter, not a raw `disconnect` from the layer)
- [x] 6.7 Add screen-reader summary via `presence.cursor.ariaLabel` (MapLibre symbol layers are not DOM-accessible; a visually hidden `aria-live` region lists friend pointers)
- [x] 6.8 Unit-test (component test with happy-dom + a mocked MapLibre map) that layers are added and removed on mount/unmount

## 7. Map integration (single line)

- [x] 7.1 Add `import FriendCursorsLayer from '@/features/presence/presentation/components/friend-cursors-layer.vue'` to `src/features/map/presentation/components/tourenbuddy-map.vue`
- [x] 7.2 Add `<friend-cursors-layer v-if="map" :map="map" />` inside the `<template>` of `tourenbuddy-map.vue`, placed after the existing `mapContainer` div as a sibling that consumes the exposed `map` ref. Confirm the diff is exactly two lines plus the import.

## 8. Internationalization

- [x] 8.1 Add `presence.cursor.ariaLabel` and `presence.cursor.label` to `src/locales/en.json` and `src/locales/de-CH.json`
- [x] 8.2 Run `npm run check:locales` and confirm parity passes

## 9. Quality gates

- [x] 9.1 Run `npx eslint . --fix` and resolve any warnings — zero warnings required
- [x] 9.2 Run `npm run type-check` and resolve any errors
- [x] 9.3 Run `npm run test` and confirm all new + existing tests pass
- [x] 9.4 Run `npm run build` and inspect the bundle output: Yjs + `@supabase-labs/y-supabase` ship inside the lazy `map-page` chunk (`dist/assets/map-page-*.js`, ~1.31 MB minified / ~360 kB gzip in this build) — acceptable for now; further code-splitting is a follow-up

## 10. Manual verification

- [x] 10.1 With two browser sessions (different verified+friended accounts), confirm that moving the mouse over the map in session A causes a colored cursor with display name to appear and follow in session B, and vice versa
- [x] 10.2 Confirm that an unauthenticated session shows nothing and triggers no Realtime subscription (DevTools → Network)
- [x] 10.3 Confirm that removing the friendship in session A immediately hides session B's cursor in session A
- [x] 10.4 Confirm that swapping the map style (base ↔ classic) preserves the cursor rendering

## 11. Documentation & follow-ups

- [x] 11.1 Add a short note in `README.md` under a "Real-time presence" subsection summarizing the feature, the privacy boundary, and that it's mouse-only for now
- [x] 11.2 File backlog issues for: (a) Supabase Realtime channel-level authorization, (b) touch presence, (c) per-tour presence rooms — **tracked in README** under Real-time presence → Backlog (GitHub issues not created from this agent run)
- [x] 11.3 Run `openspec validate add-friend-cursor-presence --strict` and confirm clean output
