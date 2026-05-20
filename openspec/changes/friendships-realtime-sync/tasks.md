## 1. Git Setup

- [x] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/136-friendships-realtime-sync`

## 2. Database Migration

- [x] 2.1 Create migration: `supabase migration new realtime_friendships_publication`
- [x] 2.2 In the new file: `alter table public.friend_requests replica identity full;` and `alter table public.friendships replica identity full;` (future-proofs filters on non-PK columns for DELETE / UPDATE events)
- [x] 2.3 In the same file, add `public.friend_requests` and `public.friendships` to publication `supabase_realtime` (idempotent via `do $$ … exception when duplicate_object then null; end $$;`)
- [x] 2.4 `supabase db reset` locally; verify (a) both tables in `supabase_realtime` (`select * from pg_publication_tables where pubname = 'supabase_realtime';`) and (b) `relreplident = 'f'` for both (`select relname, relreplident from pg_class where relname in ('friend_requests','friendships');`)
- [ ] 2.5 Manual smoke test: open two browser sessions against local Supabase; sending a request from A triggers an INSERT event observed via Supabase JS subscribe in B's devtools; deleting a friendship row (via contact-delete on A) triggers a DELETE event in B with full old-row payload

## 2a. Auth: Local-Scope Sign-Out

- [x] 2a.1 In `src/features/auth/presentation/stores/auth-store.ts`, change `signOut()` to call `supabase.auth.signOut({ scope: 'local' })` (was default global)
- [x] 2a.2 Add unit test: `signOut` passes `{ scope: 'local' }` to `supabase.auth.signOut` (spy)
- [ ] 2a.3 Manual two-device test: sign in on Device A and Device B → sign out on A → confirm B remains signed in until refresh-token expiry / explicit sign-out

## 3. Core Primitive: `useRealtimeSubscription`

- [x] 3.1 Create `src/core/realtime/use-realtime-subscription.ts` exporting the composable per design D0 (types: `PostgresChangesBinding`, `RealtimeSubscriptionOptions`; returns `{ status, channel, stop }`)
- [x] 3.2 Implement module-level `Map<string, { channel, refcount }>` registry keyed by `key` for dedupe; refcount so multiple callers share one channel and last-out triggers `removeChannel`
- [x] 3.3 Wrap all reactive setup in `effectScope()`; expose `stop()` that runs `scope.stop()` + releases the registry entry; register `onScopeDispose(stop)` so caller-scope teardown (Pinia `$dispose`, HMR, component unmount) deterministically tears the channel down even if `enabled` never flips
- [x] 3.4 Internally `watch([key, enabled], ...)`: on `(enabled && key)` create channel via `supabase.channel(key)`, attach every binding from `bindings()` via `.on('postgres_changes', { event, schema: 'public', table, filter }, payload => debouncedFn(payload))`, then `.subscribe(status => { if (status === 'SUBSCRIBED') opts.onSubscribed?.() })`; on either flip false → release registry entry, `removeChannel` when refcount hits 0
- [x] 3.5 Internal debounce helper (default 150 ms); expose `flush` / `cancel` on the debounced fn so consumers can cancel pending fires from their own `clear()` if needed (re-export via the returned object only if a consumer asks — keep API minimal)
- [x] 3.6 File header doc-comment: "never call notification dispatch from `onChange` — Realtime is UI-sync only" (convention enforced by tests in consumers)
- [x] 3.7 Module-singleton listener: `supabase.auth.onAuthStateChange((event, session) => { if (event === 'TOKEN_REFRESHED' && session) supabase.realtime.setAuth(session.access_token) })` — registered once on module load, not per-subscription
- [x] 3.8 Export test-only `__resetRealtimeRegistry()` that clears the registry map and `removeChannel`s any held channels; call it in `beforeEach` of the primitive test suite

## 4. Store: Wire Friendships to the Primitive

- [x] 4.1 In `src/features/friendships/presentation/stores/friendships-store.ts`, import `useRealtimeSubscription`; remove any direct `supabase.channel` usage (there is none today — guarantee none is introduced)
- [x] 4.2 Define `channelKey = computed(() => isAuthenticated && phoneVerified && uid ? `friendships-${uid}` : null)` and `enabled = computed(() => isAuthenticated.value && isPhoneVerified.value)`
- [x] 4.3 Implement `scheduleRefetch` (150 ms debounced wrapper around `fetchAll`)
- [x] 4.4 Call `useRealtimeSubscription({ key, enabled, bindings, onChange: scheduleRefetch, onSubscribed: () => fetchAll() })` with the four bindings from design D1 (`friend_requests` × {to_user_id, from_user_id} and `friendships` × {request_user_id, response_user_id})
- [x] 4.5 Remove the existing `watch([isAuthenticated, isPhoneVerified], …)` that calls `fetchAll` (now owned by `onSubscribed`); keep a separate auth watcher that calls `clear()` on sign-out
- [x] 4.6 In `clear()`, cancel the debounced `scheduleRefetch` (enabled flip handles channel teardown via the primitive)
- [x] 4.7 Confirm no Realtime handler path reaches `notifyFriendRequestReceived` or `notifyFriendRequestResponded` (dispatch stays in `sendRequest` / `accept` / `deny`)
- [x] 4.8 Extend the `FriendRequest` view-model type (presentation-layer only, not the Zod schema) with optional `_optimistic?: boolean`; mark the optimistic row in `sendRequest` with `_optimistic: true`
- [x] 4.9 Replace `fetchAll`'s hard list-replace with reconcile passes: `incomingRequests = reconcileRequests(serverIncoming, current)`, `outgoingRequests = reconcileRequests(serverOutgoing, current)` per design D4b (drop server-known pairs, keep in-flight optimistic temps); also dedupe `friendships` by `(request_user_id, response_user_id)`
- [x] 4.10 Update `sendRequest` success path to dedupe by id: `outgoingRequests = outgoingRequests.filter(r => r.id !== tempId && r.id !== created.id).concat(created)`

## 5. Tests

- [x] 5.1 Add `test/core/realtime/use-realtime-subscription.spec.ts`: `vi.mock('@/core/utils/supabase', ...)` with a fake `supabase` exposing `channel(name) → { on, subscribe }`, `removeChannel`, `auth.onAuthStateChange`, `realtime.setAuth`; assert (a) channel created when enabled+key, (b) `removeChannel` called when enabled flips false, (c) bindings re-attached when key changes, (d) two callers with same key share one channel and only the final disable triggers `removeChannel`, (e) debounced `onChange` coalesces bursts (advance fake timers), (f) `onSubscribed` invoked exactly once when subscribe callback yields `'SUBSCRIBED'`, and NOT invoked for any other status, (g) calling the composable inside an `effectScope()` and stopping that scope triggers `removeChannel` even when `enabled` stays true, (h) simulated `TOKEN_REFRESHED` auth event triggers `supabase.realtime.setAuth(newToken)` exactly once per refresh
- [x] 5.2 Add `test/features/friendships/realtime-wiring.spec.ts`: spy `useRealtimeSubscription`, assert friendships store calls it with the four expected bindings on sign-in+phone-verified; assert the configured `onChange` is the debounced refetch path
- [x] 5.3 Add invariant test: simulate primitive firing `onChange` events, assert `notifyFriendRequestReceived` / `notifyFriendRequestResponded` spies are never called
- [x] 5.3a Audit `src/sw.ts`: confirm `push` handler only calls `self.registration.showNotification` and `notificationclick` only does focus/navigate; no `postMessage`, no `fetch` to app routes, no client store interaction. Add a comment block above each handler stating the separation invariant
- [x] 5.4 Add reconcile tests in `test/features/friendships/`: (a) Realtime-first ordering — `sendRequest` optimistic + refetch returns server row → final list = exactly one row, no duplicate; (b) RPC-first ordering — optimistic + RPC resolves + then refetch → still one row; (c) in-flight preservation — refetch with empty server while optimistic temp present → optimistic temp preserved
- [x] 5.5 `npm run test` — all green

## 6. Manual Verification

- [ ] 6.1 Two-session test (#136): session A sends request → session B sees it appear in incoming list and menu badge without reload
- [ ] 6.2 Session B accepts → session A sees outgoing status update without reload
- [ ] 6.3 Two-session test (#138): A and B are friends with each other as contacts → A deletes the contact for B in session A → session B's contact-list friendship icon for A disappears without reload
- [ ] 6.4 Notifications regression: verify push and email still dispatch on send / accept / deny (no double-sends across tabs)
- [ ] 6.5 Sign-out scope: sign in on two tabs of same browser AND a second device → sign out on Tab A → Tab B signs out automatically; the second device stays signed in

## 7. Finalize

- [x] 7.1 `npx eslint . --fix` (zero warnings)
- [x] 7.2 `npm run type-check`
- [ ] 7.3 Prompt user to commit with conventional commit message — suggested:
  ```
  feat(friendships): realtime sync of friend_requests and friendships (#136, #138)

  Subscribe Pinia friendshipsStore to Supabase Realtime postgres_changes for
  friend_requests and friendships filtered to the current user; debounced
  refetch on event. Enable supabase_realtime publication membership via
  migration. Notification dispatch unchanged.
  ```
- [ ] 7.4 Prompt user to push branch and open PR against `main`; link issues #136 and #138 in PR body
- [ ] 7.5 Prompt user to `supabase db push` after PR review (per project rules — never run unprompted)
- [ ] 7.6 After merge, prompt user to archive change with `openspec-archive`
