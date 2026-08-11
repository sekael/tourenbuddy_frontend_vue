/**
 * Shared IndexedDB handle for the offline data domain. The read cache
 * (`entity-cache.ts`, change offline-app-cache-sync) and the write queue
 * (`write-queue.ts`, change offline-write-sync) live in the SAME database so a
 * single transaction can span both stores — the DC2 atomicity invariant: an
 * offline mutation's cache write-through and its queue enqueue commit together or
 * not at all, so ref / cache / queue never disagree at rest.
 *
 * Because both modules open the same DB name, the version + `onupgradeneeded`
 * MUST be centralized here — two modules opening one DB with different requested
 * versions throws `VersionError`. `DB_VERSION` bumped 1→2 (offline-app-cache-sync
 * shipped v1 with only `entities`) to add the two queue stores.
 */
const DB_NAME = 'tourenbuddy-data-cache'
const DB_VERSION = 2

export const ENTITY_STORE = 'entities'
export const QUEUE_STORE = 'write-queue'
export const DEAD_LETTER_STORE = 'dead-letter'

export function openDataCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // entities: out-of-line keys (cache key passed to put/get) — offline-app-cache-sync.
      if (!db.objectStoreNames.contains(ENTITY_STORE))
        db.createObjectStore(ENTITY_STORE)
      // queue + dead-letter: in-line keyPath `entityId` — exactly one entry per entity (DC1).
      if (!db.objectStoreNames.contains(QUEUE_STORE))
        db.createObjectStore(QUEUE_STORE, { keyPath: 'entityId' })
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE))
        db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'entityId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
