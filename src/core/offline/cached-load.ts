import { sessionUnverified } from '@/core/auth/session-trust'
import { getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

// Keys that have already been served a fresh network result this session. The
// cache-paint is a COLD-START optimization (instant paint on an empty ref / slow
// signal); on a warm online reload the in-memory ref is at least as fresh as the
// cache, so re-painting the (possibly stale) cache only flickers the UI back before
// the imminent network result repaints it — e.g. an online optimistic write whose
// value the cache doesn't hold yet. Track "seen fresh" so warm reloads skip the paint.
const seenFresh = new Set<string>()

/**
 * The whole offline read mechanism (change: offline-app-cache-sync, design D3):
 * hydrate-then-refetch. Every in-scope `loadX()` delegates here.
 *
 *   1. On a COLD load (key not yet served fresh this session) or when offline, read the
 *      cached snapshot and `assign` it immediately (instant paint on slow signal / offline).
 *      A WARM online reload skips this paint: the in-memory ref is already at least as
 *      fresh as the cache, so re-painting a stale cache would flicker the UI back before
 *      the imminent network result repaints it (e.g. after an online optimistic write).
 *   2. If offline, stop — the cached snapshot is the answer; an offline fetch would
 *      hang, not fail fast.
 *   3. If online, run the fetcher, `assign` the fresh result, mark the key seen, and
 *      overwrite the cache. Overwrite-on-refetch is the only reconciliation this slice
 *      needs: the server is authoritative on every successful load, so the cache never
 *      drifts past one refetch.
 *
 * On a fetcher error while online we keep the already-assigned cached snapshot (do
 * NOT blank the ref, do NOT overwrite the cache) and rethrow, so the caller's
 * existing `isLoading` / `error` contract still records the failure.
 *
 * The cache is best-effort: IndexedDB can be unavailable (private browsing, quota,
 * SSR), so a cache read/write failure degrades to a plain network load rather than
 * breaking the store. The fetcher error is the only one that propagates.
 */
export async function cachedLoad<T>(
  key: string,
  fetcher: () => Promise<T>,
  assign: (value: T) => void,
): Promise<void> {
  // Start the network immediately (when online) so it runs in PARALLEL with the
  // cache read rather than behind its latency. The cache still paints first below;
  // this only decides when the request leaves, not the assign order.
  // An unverified session counts as offline (design D9, matching `mutate`): every
  // supabase-js request resolves its access token through `auth.getSession()` first, so
  // fetching against a stale token doesn't fail fast — it queues behind auth-js's 30s
  // refresh-retry loop and hangs the caller. The cached snapshot is the answer until a
  // real token lands, at which point realtime's onSubscribed refetches.
  const reachable = isOnline.value && !sessionUnverified.value
  const fresh = reachable ? fetcher() : undefined
  // Mark the in-flight fetch handled so a rejection during the cache-read await
  // window can't surface as an unhandledrejection — we still observe it at `await`.
  void fresh?.catch(() => {})

  // Cold start or offline paints the cache; a warm online reload skips it (see seenFresh).
  // Offline (fresh === undefined) ALWAYS paints — the cache is the only answer there.
  if (fresh === undefined || !seenFresh.has(key)) {
    const cached = await readCache<T>(key)
    if (cached !== undefined)
      assign(cached)
  }

  // Offline: no request was made; the cached snapshot (if any) stands.
  if (fresh === undefined)
    return

  const result = await fresh
  assign(result)
  seenFresh.add(key)
  await writeCache(key, result)
}

/** Cache read is best-effort: a missing key or unavailable IndexedDB → no snapshot. */
async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    return await getCached<T>(key)
  }
  catch {
    return undefined
  }
}

/** Cache write is best-effort: a failed persist must not fail the (successful) load. */
async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await putCached(key, value)
  }
  catch {
    // swallow — the store ref already holds the fresh value; only the shadow missed.
  }
}
