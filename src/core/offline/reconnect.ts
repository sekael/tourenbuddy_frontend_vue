import { replayQueue } from './replay'

/**
 * DC4 reconnect ordering: drain the durable write queue, THEN refetch — so a replayed
 * offline write lands server-side before the fresh snapshot overwrites the store,
 * closing the offline-app-cache-sync D6 clobber hazard. `replayQueue()` is single-
 * flight, so N stores calling this on the same WS `SUBSCRIBED` event share ONE drain.
 *
 * The `await` is load-bearing: kickstart-and-forget would re-race the refetch against
 * the drain. A failed flush still refetches — never strand the store on stale cache.
 */
export async function flushThenRefetch(refetch: () => Promise<void>): Promise<void> {
  await replayQueue().catch(() => {})
  await refetch()
}
