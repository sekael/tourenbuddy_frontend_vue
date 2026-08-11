import type { IncomingWrite, WriteQueueEntry } from '@/core/offline/write-queue'
import { ref } from 'vue'
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
  = | { queued: false, value: T }
    | { queued: true }

export function mutate<T>(fn: () => T | Promise<T>): Promise<T | undefined>
export function mutate<Row>(spec: MutateSpec<Row>): Promise<MutateOutcome<Row[] | void>>
export async function mutate(arg: unknown): Promise<unknown> {
  // Block form — a bare function. Preserves offline-app-cache-sync behaviour.
  if (typeof arg === 'function') {
    if (!isOnline.value) {
      offlineBlockedAt.value = Date.now()
      return undefined
    }
    return (arg as () => unknown)()
  }

  const spec = arg as MutateSpec<unknown>
  if (isOnline.value)
    return { queued: false, value: await spec.run() }

  await enqueueOffline(spec)
  spec.assign(spec.apply(spec.current)) // ref AFTER commit (below)
  savedOfflineAt.value = Date.now()
  return { queued: true }
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

    tx.objectStore(ENTITY_STORE).put(next, spec.cacheKey)
    if (merged === null)
      queue.delete(spec.intent.entityId) // annihilated create+delete
    else
      queue.put(merged)

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
