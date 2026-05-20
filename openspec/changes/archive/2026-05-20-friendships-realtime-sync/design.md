## Context

`friendshipsStore` fetches `friend_requests` + `friendships` once per auth+phone-verified session and never re-reads. Web Push exists (#112) but is opt-in and unreliable as a UI sync signal. DB-level cleanup triggers (migration `20260519185500`) already delete `friendships` rows when one side breaks the contact link — but the other party's UI keeps the stale icon until reload (#138). Supabase JS v2 supports `postgres_changes` channels that honor RLS, which is the canonical fix for both gaps.

Constraints:
- RLS on `friend_requests` and `friendships` restricts SELECT to involved users; Realtime piggybacks on these policies. No policy widening allowed.
- Notifications (push + email) MUST remain functional and unchanged. Realtime is a UI channel; notification dispatch is separate.
- Supabase free tier; one channel per signed-in user is acceptable.
- Optimistic updates in store must not be undone by Realtime echoes of the user's own writes.

## Goals / Non-Goals

**Goals:**
- Incoming friend requests, status changes (accept/deny/cancel), and friendship row inserts/deletes propagate to the affected user's UI without reload.
- When the other party's contact deletion triggers DB cleanup, the friendship icon disappears in the remaining user's contact list within seconds.
- Channel lifecycle is bound to auth: subscribe when authenticated AND phone-verified; unsubscribe on sign-out or phone removal.
- Single migration enabling Realtime replication for `friend_requests` and `friendships`.
- **Proof-of-concept for a reusable realtime primitive** (`core/realtime/use-realtime-subscription.ts`) that future features (`tours` first) can adopt with minimal incremental code — bindings + refetch + enabled flag, lifecycle handled centrally.

**Non-Goals:**
- Driving notification dispatch from Realtime payloads (kept in current explicit-call code path).
- Realtime on `contacts` / `contact_methods` (out of scope — #138 is solved via the `friendships` DELETE event).
- Push-payload-driven refresh as backup channel (mentioned out of scope by #136).
- Presence / broadcast channel features.
- Cross-tab dedupe via BroadcastChannel.
- Realtime on `push_subscriptions` — rows are per-device by design; no cross-device sync of push enablement state is required.

## Decisions

### D0. Reusable primitive: `useRealtimeSubscription`

Introduce `src/core/realtime/use-realtime-subscription.ts` as the single point where the app talks to Supabase Realtime. All feature stores consume it; none touch `supabase.channel` directly.

**Shape:**

```ts
// src/core/realtime/use-realtime-subscription.ts
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface PostgresChangesBinding {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string                       // default 'public'
  table: string
  filter?: string                       // e.g. 'to_user_id=eq.<uid>'
}

export interface RealtimeSubscriptionOptions {
  /** Stable key — used to dedupe channels (e.g. `friendships-<uid>`, `tours-<uid>`). */
  key: Ref<string | null> | ComputedRef<string | null>
  /** Subscribe only while true. Flip false → channel torn down. */
  enabled: Ref<boolean> | ComputedRef<boolean>
  /** Bindings recomputed when key changes. Return [] to no-op. */
  bindings: () => PostgresChangesBinding[]
  /** Called (debounced) when any binding fires. Receives the payload for optional inspection but should treat refetch as the canonical update path. */
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  /** Called once the channel reaches `SUBSCRIBED` status. Use this to fetch the baseline state AFTER bindings are live, eliminating the subscribe/fetch race. Errors swallowed-logged. */
  onSubscribed?: () => void | Promise<void>
  /** Debounce window for coalescing bursts. Default 150 ms. */
  debounceMs?: number
}

export function useRealtimeSubscription(opts: RealtimeSubscriptionOptions): {
  status: Ref<'idle' | 'subscribing' | 'subscribed' | 'error'>
  channel: ShallowRef<RealtimeChannel | null>
  /** Manual teardown. Also wired to the caller's effect scope automatically. */
  stop: () => void
}
```

**Behavior:**
- All internal reactivity wrapped in `effectScope()` so teardown is deterministic. `onScopeDispose(stop)` is registered so that when the caller's owning scope ends (Pinia `$dispose`, HMR module replace, parent component unmount), the channel is removed even if `enabled` never flips false.
- Inside the scope, `watch([key, enabled])` — on `(enabled && key)` create the channel, attach all bindings, `subscribe(status => …)`; on either flip, release registry entry; on refcount hit zero, `supabase.removeChannel`. If `bindings()` returns an empty array (consumer is not ready), the primitive does not create a channel; the watch re-evaluates when reactive deps inside `bindings()` change.
- Module-level `Map<string, { channel, refcount }>` deduplicates by key. A test-only export `__resetRealtimeRegistry()` clears the map and removes any held channels — called from test `beforeEach` to prevent cross-test bleed; not part of the public API and not used by app code. Two callers requesting the same key share one channel; the final release triggers `removeChannel`.
- Token refresh: primitive registers `supabase.auth.onAuthStateChange` once at module load; on `TOKEN_REFRESHED` it calls `supabase.realtime.setAuth(session.access_token)` defensively (the SDK does this internally, but the explicit call is cheap insurance and makes the contract observable in tests). The listener is module-singleton — not per-subscription — to avoid N-listener fan-out.
- Notification dispatch is **not** part of this primitive. A lint-style convention (commented at the top of the file) plus a test in the friendships consumer enforces "no `notify*` calls inside `onChange`."

**Friendships consumer (this change):**

```ts
const channelKey = computed(() => authStore.currentUser?.id && isPhoneVerified.value
  ? `friendships-${authStore.currentUser.id}` : null)

useRealtimeSubscription({
  key: channelKey,
  enabled: computed(() => authStore.isAuthenticated && isPhoneVerified.value),
  bindings: () => {
    const uid = authStore.currentUser?.id
    if (!uid) return []
    return [
      { event: '*', table: 'friend_requests', filter: `to_user_id=eq.${uid}` },
      { event: '*', table: 'friend_requests', filter: `from_user_id=eq.${uid}` },
      { event: '*', table: 'friendships',     filter: `request_user_id=eq.${uid}` },
      { event: '*', table: 'friendships',     filter: `response_user_id=eq.${uid}` },
    ]
  },
  onChange: () => scheduleRefetch(),   // -> debounced fetchAll
  onSubscribed: () => fetchAll(),       // baseline AFTER channel is live (eliminates subscribe/fetch race)
})
```

The friendships store removes its existing `watch([isAuthenticated, isPhoneVerified])`-triggered `fetchAll` (the primitive now owns "fetch when ready"). Sign-out path (`isAuthenticated` flips false) still calls `clear()` via a single auth watcher, which also cancels pending debounced refetch.

**Future tours consumer (worked example — do NOT implement in this change):**

```ts
// src/features/tours/presentation/stores/tours-store.ts (future)
const channelKey = computed(() => authStore.currentUser?.id ? `tours-${authStore.currentUser.id}` : null)

useRealtimeSubscription({
  key: channelKey,
  enabled: computed(() => authStore.isAuthenticated),
  bindings: () => {
    const uid = authStore.currentUser?.id
    if (!uid) return []
    return [
      { event: '*', table: 'tours',         filter: `owner_user_id=eq.${uid}` },
      { event: '*', table: 'tour_contacts', filter: `user_id=eq.${uid}` },
    ]
  },
  onChange: () => scheduleRefetch(),
  onSubscribed: () => fetchAll(),
})
```

The tours adoption is ~10 lines plus a migration adding its tables to `supabase_realtime`. No new primitive, no new tests for lifecycle, no new auth wiring.

Rationale: per-store handcrafted channel code would grow N copies of the same lifecycle bugs (token refresh, double-subscribe, leaked channels on HMR, cross-test pollution). One primitive, tested once.

Alternative considered:
- A Pinia plugin that auto-injects realtime per store. Rejected — too magic; bindings are feature-specific and should be visible at the call site.
- Wrapping channels in a global service singleton. Rejected — harder to test, no obvious reactivity story with Vue refs.

### D1. Use `postgres_changes` on a single per-user channel
Subscribe once to `realtime:friendships-<uid>` with multiple `postgres_changes` bindings:
- `friend_requests` filtered by `to_user_id=eq.<uid>` (incoming)
- `friend_requests` filtered by `from_user_id=eq.<uid>` (outgoing status updates)
- `friendships` filtered by `request_user_id=eq.<uid>`
- `friendships` filtered by `response_user_id=eq.<uid>`

Rationale: `postgres_changes` requires server-side filter expressions (cannot OR across columns in one binding). Two bindings per table is the documented pattern. One channel keeps WS overhead minimal.

Alternative considered: separate channels per table — adds connection overhead with no gain.

### D2. Refetch on any event (simple, correct)
Handler calls `fetchAll()` debounced ~150 ms. RLS already filters; the refetch is the canonical state.

Rationale: payload-diff merging is error-prone with optimistic placeholders (temp ids), DB triggers (cascade deletes), and out-of-order events. Refetch volume is tiny (a few rows). 150 ms debounce coalesces bursts (e.g., accept = update `friend_requests` + insert `friendships`).

Alternative considered: apply per-row diffs from `payload.new` / `payload.old`. Rejected — complex, brittle, and the gain is negligible at this scale.

### D2a. Subscribe-then-baseline-fetch (no race window)
Baseline `fetchAll` runs from the primitive's `onSubscribed` callback, fired when `.subscribe()` reports `'SUBSCRIBED'`. This guarantees the channel is live before the baseline read, so any event arriving during/after the fetch is observed (or coalesced by the debounce). The previous "fetchAll on enable" watcher is removed from the store.

Rationale: fetch-then-subscribe has a small race window during which DB writes are lost. Subscribe-first cleanly closes it. If `SUBSCRIBED` never fires (WS down, server unreachable), the baseline never loads — acceptable failure mode: empty UI with an error indicator is better than stale phantom state, and reconnect will retrigger `onSubscribed`.

### D3. Subscribe on `(authenticated && phoneVerified)`, unsubscribe on either flip
The store passes `enabled = authenticated && phoneVerified` into `useRealtimeSubscription`; the primitive's internal `watch` handles teardown. `clear()` does not need explicit unsubscribe because flipping `enabled` already removes the channel — but `clear()` still calls `cancel()` on the pending debounced refetch to avoid a post-signout fetch.

Rationale: RLS requires an authenticated JWT and access policies key on `phone_confirmed_at`; subscribing before phone verification yields no events anyway. Matches the gating already used for `fetchAll`.

### D4. Enable Realtime replication via migration
New migration:
```sql
-- Belt-and-suspenders: FULL replica identity so DELETE/UPDATE events carry
-- every column, allowing server-side filters on non-PK columns
-- (e.g. friend_requests.to_user_id) to match reliably even on DELETE.
alter table public.friend_requests replica identity full;
alter table public.friendships     replica identity full;

-- Publication membership (idempotent).
do $$ begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;
```

Rationale: explicit, repo-tracked, applied locally first per project rules. No RLS changes — Realtime authorizes via existing SELECT policies. FULL replica identity on these small, low-write tables is negligible WAL overhead and future-proofs against (a) a future DELETE on `friend_requests` and (b) any future filter on a non-PK column of either table.

**RLS visibility check** (verified against `20260101000000_initial_schema.sql`):
- `friendships_select`: `auth.uid() = request_user_id OR auth.uid() = response_user_id`. Realtime evaluates this against the OLD row on DELETE; with FULL identity both columns are present, so the remaining party passes the check and receives the DELETE event. This is what closes #138.
- `friend_requests_select`: `auth.uid() = from_user_id OR auth.uid() = to_user_id`. Identical pattern; works for UPDATE events on the cleanup path.

If either of these SELECT policies is ever narrowed (e.g. requiring `phone_confirmed_at`), Realtime visibility narrows with it — re-verify these scenarios before merging such a change.

### D4a. Sign-out scoped to current device
Change `authStore.signOut()` to call `supabase.auth.signOut({ scope: 'local' })` instead of the default global scope.

Rationale:
- **Current behavior (bug, surfaced by this change):** default `scope: 'global'` revokes the refresh token server-side for every device + PWA install. Sign-out on a tab pushes the user out of their phone, their installed PWA, every laptop tab. Surprising and bad UX.
- **Desired behavior:** sign-out on one tab signs out all *tabs of the same browser profile on the same device* (handled automatically by supabase-js `multiTab` storage-event sync — already on by default with bare `createClient(...)`). Other devices and other PWA installs (each with their own localStorage) retain their refresh tokens until their own user-initiated sign-out or token expiry.
- This is necessary infra for Realtime: a per-device sign-out cleanly flips `isAuthenticated` in this tab AND its sibling tabs, the primitive's `enabled` flips false in every affected tab, and channels tear down deterministically — without nuking sessions on the user's other devices.

Note: same-device cross-context isolation (e.g. Android Chrome PWA vs Chrome browser tabs sharing localStorage) is decided by the browser's storage model, not by us. iOS standalone PWAs have isolated storage and are naturally unaffected. We don't add custom per-context storage keys — that's out of scope.

### D4b. Optimistic-row reconciliation (no duplicate flash, no wiped placeholder)

Realtime introduces two race orderings for any optimistic write — RPC-first vs Realtime-first. Without care, the user sees either a duplicate row (Realtime-first → `fetchAll` inserts the real row, then RPC success path appends it again) or a wiped placeholder mid-flight (refetch hard-replaces the temp before RPC returns). Fix both deterministically.

**Mechanism:**
1. Optimistic rows added by store actions (only `sendRequest` today) carry a transient marker `_optimistic: true`. Server rows never carry it.
2. `fetchAll` no longer hard-replaces. It runs a small reconcile pass per list:
   ```ts
   function reconcileRequests(server: FriendRequest[], current: FriendRequest[]): FriendRequest[] {
     const serverPairs = new Set(server.map(r => `${r.fromUserId}|${r.toUserId}`))
     const inFlight = current.filter(r => r._optimistic && !serverPairs.has(`${r.fromUserId}|${r.toUserId}`))
     return [...server, ...inFlight]
   }
   ```
   Result: server is authoritative for any pair it knows about; in-flight optimistic temps whose pair the server hasn't seen yet survive the refetch.
3. Mutator success paths dedupe by id when integrating server response:
   ```ts
   outgoingRequests.value = outgoingRequests.value
     .filter(r => r.id !== tempId && r.id !== created.id)
     .concat(created)
   ```
   This covers RPC-first (where `created` isn't in the list yet) AND Realtime-first (where `created.id` may already be present via the refetch).

**Trace under Realtime-first ordering (was: duplicate flash):**
1. `sendRequest` → temp row in outgoing.
2. Realtime INSERT → debounced refetch.
3. `fetchAll` reconcile: server has real row, pair matches → temp dropped, real row shown. No duplicate.
4. RPC returns → success path dedupes by id → list stays `[real]`. Clean.

**Trace under RPC-first ordering (was: fine):**
1. Temp in outgoing.
2. RPC returns → success path: `[real]`.
3. Refetch → reconcile: server has `[real]`, current has `[real]`, no in-flight temps → `[real]`. Clean.

**Why not just disable optimistic writes:** RPC + refetch round-trip is ~200–400 ms on free-tier Supabase; users notice. Optimistic stays.

**Other mutators** (`accept`, `deny`, `cancel`) only *remove* from lists or add a `Friendship` keyed by real user ids. They don't use temp ids and have no duplicate-flash risk; their existing logic is preserved. The new `Friendship` reconcile pass dedupes by `(request_user_id, response_user_id)` PK to be safe for future code paths.

### D5. Strict separation: push = OS notification only, Realtime = UI sync only
Two independent pathways with no crossover:

- **Realtime (this change):** drives in-app UI state. Handlers MUST NOT call `notify*` dispatch and MUST NOT post messages that result in OS notifications.
- **Push / email (existing, unchanged):** `notifyFriendRequestReceived` / `notifyFriendRequestResponded` are called only from explicit, intent-bound store actions (`sendRequest`, `accept`, `deny`). The service worker's `push` handler in `src/sw.ts` MUST only call `self.registration.showNotification` and (in `notificationclick`) focus/navigate a client — it MUST NOT `postMessage` to clients with the intent of mutating store state, and MUST NOT itself trigger refetches. Verified today: `src/sw.ts:55-101` already conforms.

Rationale: clean concern separation. Each pathway is independently observable, testable, and replaceable. Notifications surface the OS-level signal; Realtime keeps the open tab's UI fresh. They converge on the recipient by coincidence, never by coupling. This also means a user with push disabled is fully served by Realtime in-app, and a user with the app closed is served by push out-of-app.

## Risks / Trade-offs

- [Realtime channel auth lags after token refresh] → Supabase JS v2 auto-rebinds the access token on channels; we rely on this. If observed flakiness, add an explicit `setAuth` call on the channel after `onAuthStateChange` token-refresh events.
- [Optimistic placeholder duplication] → Resolved by D4b reconcile + dedupe-by-id; no visible duplicate flash in either ordering.
- [Refetch storm on accept-cascade] → Accept triggers UPDATE on `friend_requests` + INSERT on `friendships`, possibly fanning 2 events to both users. 150 ms debounce coalesces.
- [Free-tier Realtime quotas] → One channel per active user with low message volume is well under limits. Acceptable.
- [#138 still requires the OTHER party's DB trigger to have run] → DB-level cleanup already handles this (migration `20260519185500`); we only consume the resulting DELETE event. No behavioral risk if that migration is present (it is, on `main`).
- [No realtime when phone unverified] → By design; users without verified phone cannot have friendships anyway.
- [Concurrent-tab notification duplication] → Non-issue: notification dispatch is bound to user intent (the tab that calls `accept` / `deny` / `sendRequest`), not to row events. Other tabs of the same user only refetch via Realtime; they never call `notify*`. Other users receive exactly one dispatch from the acting tab.
- [Offline / WS unreachable] → Naturally self-healing: Supabase JS v2 auto-reconnects with backoff. While disconnected, state is stale but never inconsistent (no events received, no events processed). On reconnect `'SUBSCRIBED'` fires again → `onSubscribed` runs `fetchAll` → baseline catches up. Action attempts while offline fail at the RPC layer and existing optimistic-rollback paths handle them. No offline queue required.

## Migration Plan

1. Add migration `<timestamp>_realtime_friendships_publication.sql` enabling Realtime publication membership for both tables.
2. `supabase db reset` locally → verify with two browser sessions that INSERT/UPDATE/DELETE events arrive.
3. Wire store subscription + handler; ship behind no flag (Realtime is purely additive — falling back to the existing on-mount fetch if WS unavailable).
4. `supabase db push` to prod after review.

Rollback: revert store changes; the publication addition is safe to keep (no consumers means no cost).
