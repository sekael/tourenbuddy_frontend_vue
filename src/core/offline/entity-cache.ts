import { useLogger } from '@/core/logging/use-logger'

/**
 * Last-known-good local cache of store-loaded domain collections, so the app can
 * render tours / contacts / profile / calendar / friendships offline (change:
 * offline-app-cache-sync). A hand-rolled key→value IndexedDB store, the same
 * primitive the offline-map slice uses for its region ledger
 * (`features/map/data/services/offline-region-store.ts`) — no new dependency.
 *
 * Its own database, separate from the map feature's `tourenbuddy-offline`, because
 * `core/` must not depend on a feature and each can evolve its schema (DB_VERSION)
 * independently (design D2). Values are structured-cloned as-is (arrays of domain
 * entities, Sets, composites) — IndexedDB uses structured clone, so no JSON step.
 * Keys are `<collection>:<uid>` so one account never reads another's cache (D1).
 */
const logger = useLogger('EntityCache')
const DB_NAME = 'tourenbuddy-data-cache'
const DB_VERSION = 1
const STORE = 'entities'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // Out-of-line keys: the cache key is passed to put/get, not stored on the value.
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, mode)
    return await promisify(fn(tx.objectStore(STORE)))
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
