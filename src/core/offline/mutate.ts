import type { IncomingWrite, WriteQueueEntry } from '@/core/offline/write-queue'
import { ref, toRaw } from 'vue'
import { sessionUnverified } from '@/core/auth/session-trust'
import { useLogger } from '@/core/logging/use-logger'
import {
  ENTITY_STORE,
  openDataCacheDb,
  promisify,
  QUEUE_STORE,
} from '@/core/offline/data-cache-db'
import { isOnline } from '@/core/offline/use-online-status'
import {
  assertQueueHeadroom,
  coalesce,

} from '@/core/offline/write-queue'

const logger = useLogger('Mutate')

/**
 * The single seam every in-scope mutation store action passes through (change:
 * offline-app-cache-sync → offline-write-sync). Two forms:
 *
 * - **Block form** `mutate(fn)` — online runs `fn`; offline bumps `offlineBlockedAt`
 *   and drops. Unchanged from offline-app-cache-sync; kept for writes that stay
 *   offline-blocked (tour attachments, DC10) and for stores not yet migrated.
 * - **Queue form** `mutate(spec)` — online runs `spec.run`; offline **enqueues** the
 *   mutation, applies it optimistically, and write-throughs the entity cache so an
 *   offline reload keeps the pending edit (DC2). Returns a discriminated outcome.
 *
 * DC2 atomicity: the cache write-through and the queue enqueue commit in ONE
 * IndexedDB transaction spanning both stores (possible because they share
 * `tourenbuddy-data-cache`, DC1). Either both land or neither does, so ref, cache,
 * and queue never disagree at rest. The in-memory ref is assigned only AFTER the
 * durable transaction commits — it never claims a durability the disk lacks.
 */
export const offlineBlockedAt = ref(0)

/** Bumped on every successful offline enqueue so the UI can toast "saved offline" (section 8). */
export const savedOfflineAt = ref(0)

/**
 * i18n KEY of the last offline-write failure (IndexedDB unavailable / near-quota / a value
 * structured-clone can't serialize), or `null` when clear. The seam swallows the raw IDB
 * error into this signal so callers never surface a `DataCloneError` to the user; a snackbar
 * watches it and edit surfaces clear it on enter/exit (via `clearOfflineWriteError`).
 */
export const offlineWriteError = ref<string | null>(null)

/** Clear the offline-write error signal — called on entering / leaving an edit surface. */
export function clearOfflineWriteError(): void {
  offlineWriteError.value = null
}

/**
 * Queue-form spec. The action expresses its change as a pure transform over the
 * cached collection (`apply`), reused for both the durable cache and the ref so the
 * two can't drift.
 */
export interface MutateSpec<Row> {
  /** The online body — repo call(s) + GPX + notify. Run verbatim when online. */
  run: () => Promise<Row[] | void> | Row[] | void
  /** Serializable queue intent (DC1). Caller sets `baseSnapshot`/`baseUpdatedAt` for `op=update`. */
  intent: IncomingWrite
  /** Collection cache key, e.g. `tours:<uid>` — the same key `cachedLoad` writes. */
  cacheKey: string
  /** Current collection from the store ref — the base the transform applies to. */
  current: Row[]
  /** Pure transform producing the next collection (add / replace / remove the entity). */
  apply: (rows: Row[]) => Row[]
  /** Assign the next collection to the store ref (runs after the durable commit). */
  assign: (rows: Row[]) => void
  /** Approx bytes this enqueue adds (blob sizes + slack) for the quota guard. */
  projectedBytes?: number
}

export type MutateOutcome<T>
  = | { queued: false, failed: false, value: T } // ran online
    | { queued: true, failed: false } // enqueued offline
    | { queued: false, failed: true } // offline enqueue failed (IDB) — swallowed to the signal

export function mutate<T>(fn: () => T | Promise<T>): Promise<T | undefined>
export function mutate<Row>(spec: MutateSpec<Row>): Promise<MutateOutcome<Row[] | void>>
export async function mutate(arg: unknown): Promise<unknown> {
  // Block form — a bare function. Preserves offline-app-cache-sync behaviour.
  if (typeof arg === 'function') {
    // Same rule as the spec form below: an unverified session can't reach the server.
    // Block-form actions have no queue representation, so they're refused rather than
    // deferred — the user is told, instead of watching the call fail.
    if (!isOnline.value || sessionUnverified.value) {
      offlineBlockedAt.value = Date.now()
      return undefined
    }
    return (arg as () => unknown)()
  }

  const spec = arg as MutateSpec<unknown>
  // Online failures still throw out of `run` (the store's own try/catch owns them); the
  // seam only intercepts the OFFLINE path, where an IndexedDB error is ours to handle.
  //
  // An UNVERIFIED session counts as offline for writes (design D9): the token is stale,
  // so the server would reject the call and the edit would die in the store's error
  // state instead of landing in the durable queue. Reads stay on the online path — a
  // failed refetch keeps the painted cache snapshot, which is degradation, not loss.
  if (isOnline.value && !sessionUnverified.value)
    return { queued: false, failed: false, value: await spec.run() }

  try {
    await enqueueOffline(spec)
  }
  catch (err) {
    // Swallow the raw IDB error (DataCloneError / quota / tx failure) into the signal so no
    // caller surfaces it directly. The ref is UNTOUCHED here — `assign` runs only after a
    // clean commit — so the store still shows the pre-edit state (no phantom optimistic row).
    logger.error('Offline write enqueue failed', err)
    offlineWriteError.value
      = err instanceof Error && err.message === 'offline-queue-storage-full'
        ? 'offline.writeError.storageFull'
        : 'offline.writeError.generic'
    return { queued: false, failed: true }
  }
  spec.assign(spec.apply(spec.current)) // ref AFTER commit (above)
  savedOfflineAt.value = Date.now()
  return { queued: true, failed: false }
}

/**
 * Strip Vue reactivity so IndexedDB's structured clone can serialize the value.
 * A `reactive()` graph is backed by Proxies, and structured clone throws
 * `DataCloneError` on a Proxy — so BOTH the queue entry (its `baseSnapshot`/payload
 * come straight off store refs) AND the cache write-through (the store's reactive
 * collection) must be de-proxied first, or every offline update fails silently.
 * Recurse through plain objects/arrays and `toRaw` each level; Blobs and Dates are
 * cloneable as-is and pass through untouched.
 */
function toStorable<T>(value: T): T {
  const raw = toRaw(value as unknown as object) as unknown
  if (Array.isArray(raw))
    return raw.map(v => toStorable(v)) as unknown as T
  if (raw && typeof raw === 'object' && !(raw instanceof Blob) && !(raw instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(raw))
      out[key] = toStorable((raw as Record<string, unknown>)[key])
    return out as T
  }
  return raw as T
}

/**
 * DC2 atomic offline enqueue: write the transformed collection to the cache and the
 * coalesced intent to the queue in ONE transaction. Quota is checked first so a full
 * disk refuses the write cleanly instead of half-applying it.
 */
async function enqueueOffline(spec: MutateSpec<unknown>): Promise<void> {
  await assertQueueHeadroom(spec.projectedBytes ?? 0)
  const next = spec.apply(spec.current)

  const db = await openDataCacheDb()
  try {
    const tx = db.transaction([ENTITY_STORE, QUEUE_STORE], 'readwrite')
    const queue = tx.objectStore(QUEUE_STORE)

    const all = await promisify(queue.getAll() as IDBRequest<WriteQueueEntry[]>)
    const existing = all.find(e => e.entityId === spec.intent.entityId)
    const seq = existing?.seq ?? (all.reduce((m, e) => Math.max(m, e.seq), 0) + 1)
    const merged = coalesce(existing, { ...spec.intent, seq, attempts: 0 })

    tx.objectStore(ENTITY_STORE).put(toStorable(next), spec.cacheKey)
    if (merged === null)
      queue.delete(spec.intent.entityId) // annihilated create+delete
    else
      queue.put(toStorable(merged))

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  finally {
    db.close()
  }
}
