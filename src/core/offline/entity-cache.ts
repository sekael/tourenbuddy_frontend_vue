import { useLogger } from '@/core/logging/use-logger'
import { ENTITY_STORE, openDataCacheDb, promisify } from '@/core/offline/data-cache-db'

/**
 * Last-known-good local cache of store-loaded domain collections, so the app can
 * render tours / contacts / profile / calendar / friendships offline (change:
 * offline-app-cache-sync). A hand-rolled key→value IndexedDB store, the same
 * primitive the offline-map slice uses for its region ledger
 * (`features/map/data/services/offline-region-store.ts`) — no new dependency.
 *
 * Its own database, separate from the map feature's `tourenbuddy-offline`, because
 * `core/` must not depend on a feature and each can evolve its schema
 * independently (design D2). The DB handle + `onupgradeneeded` moved to
 * `data-cache-db.ts` so the write queue (offline-write-sync) can share the same DB
 * — DC2 needs one transaction spanning the cache + queue stores. Values are
 * structured-cloned as-is (arrays of domain entities, Sets, composites) — no JSON
 * step. Keys are `<collection>:<uid>` so one account never reads another's cache (D1).
 */
const logger = useLogger('EntityCache')

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDataCacheDb()
  try {
    const tx = db.transaction(ENTITY_STORE, mode)
    return await promisify(fn(tx.objectStore(ENTITY_STORE)))
  }
  finally {
    db.close()
  }
}

/** Read a cached collection; resolves `undefined` for a never-written key (not a throw). */
export function getCached<T>(key: string): Promise<T | undefined> {
  return withStore('readonly', store => store.get(key) as IDBRequest<T | undefined>)
}

/** Overwrite the cached snapshot for `key` with a fresh last-known-good value. */
export function putCached<T>(key: string, value: T): Promise<IDBValidKey> {
  logger.debug('put cached', key)
  return withStore('readwrite', store => store.put(value, key))
}

/** Drop a cached snapshot (e.g. on logout / schema drift). */
export function clearCached(key: string): Promise<undefined> {
  return withStore('readwrite', store => store.delete(key) as IDBRequest<undefined>)
}
