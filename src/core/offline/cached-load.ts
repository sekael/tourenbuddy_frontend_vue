import { getCached, putCached } from '@/core/offline/entity-cache'
import { isOnline } from '@/core/offline/use-online-status'

/**
 * The whole offline read mechanism (change: offline-app-cache-sync, design D3):
 * hydrate-then-refetch. Every in-scope `loadX()` delegates here.
 *
 *   1. Read the cached snapshot; if present, `assign` it immediately (instant paint,
 *      including a cold start on slow signal).
 *   2. If offline, stop — the cached snapshot is the answer; an offline fetch would
 *      hang, not fail fast.
 *   3. If online, run the fetcher, `assign` the fresh result, and overwrite the cache.
 *      Overwrite-on-refetch is the only reconciliation this slice needs: the server is
 *      authoritative on every successful load, so the cache never drifts past one
 *      refetch.
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
  const fresh = isOnline.value ? fetcher() : undefined
  // Mark the in-flight fetch handled so a rejection during the cache-read await
  // window can't surface as an unhandledrejection — we still observe it at `await`.
  void fresh?.catch(() => {})

  const cached = await readCache<T>(key)
  if (cached !== undefined)
    assign(cached)

  // Offline: no request was made; the cached snapshot (if any) stands.
  if (fresh === undefined)
    return

  const result = await fresh
  assign(result)
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
