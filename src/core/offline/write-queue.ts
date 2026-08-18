import {
  DEAD_LETTER_STORE,
  openDataCacheDb,
  promisify,
  QUEUE_STORE,
} from '@/core/offline/data-cache-db'

/**
 * Durable FIFO-by-`seq` outbox of offline data mutations (change:
 * offline-write-sync, DC1). Exactly ONE entry per entity, keyed by `entityId`: an
 * offline create followed by offline edits of the same tour coalesces into a single
 * entry (a create of the final desired state), never a create + N edit rows —
 * so replay is one idempotent call per entity and the queue can't grow unbounded
 * from repeated edits.
 *
 * These are the low-level store ops + the pure `coalesce` reducer. The atomic
 * enqueue (cache write-through + coalesce + put, in ONE transaction) lives in
 * `mutate.ts` (DC2), which drives its own transaction over both stores — that is
 * why enqueue is not a self-contained op here.
 */

export type WriteOp = 'create' | 'update' | 'delete'

export interface WriteQueueEntry {
  /** Client-minted UUID — the entity already carries its final id (no temp→server remap, DC0). */
  entityId: string
  /** Selects the replay handler in the registry (`'tour' | 'contact' | …`, DC3). */
  kind: string
  /** Net effect on the server row — selects the replay call + notify copy (DC1). */
  op: WriteOp
  /** Full final desired state of the entity (structured-cloneable). Later edits replace it. */
  payload: unknown
  /** Binary payloads (e.g. a GPX `File`). IndexedDB stores Blobs natively — no base64. */
  blobs?: Record<string, Blob>
  /** `op=update` only: pre-edit cached server state, so a discard restores it without a refetch (DC9). */
  baseSnapshot?: unknown
  /** `op=update` only: `baseSnapshot`'s SERVER `updated_at` — the LWW baseline (DC5). NOT a client clock. */
  baseUpdatedAt?: string
  /** Tours only: `snapshotTourGroupContext(id)` at the first offline edit, for deferred eviction (DC6). */
  linkSnapshot?: unknown
  /** Monotonic insertion counter — cross-entity drain order for FK deps (DC1). Preserved on coalesce. */
  seq: number
  /** Replay attempts so far — drives capped backoff / dead-letter (DC9). */
  attempts: number
  /**
   * Dead-letter only: why it gave up, so the review surface can decide what to offer.
   * - `conflict`  — LWW loser (DC5): server moved past our frozen baseUpdatedAt. Retry re-runs the
   *   same losing comparison → never succeeds. Discard only.
   * - `permanent` — non-retryable server rejection (validation / RLS / 404 / cascade). Same payload,
   *   same result → never succeeds. Discard only.
   * - `transient` — exhausted the attempt budget on a network/5xx error. The server may recover
   *   later, so a manual retry can still land. Retry offered.
   */
  deadReason?: 'conflict' | 'permanent' | 'transient'
}

/**
 * A fresh mutation to fold into the queue. `seq`/`attempts` are queue bookkeeping
 * assigned by the caller (`mutate`), not part of the intent an action supplies.
 */
export type IncomingWrite = Omit<WriteQueueEntry, 'seq' | 'attempts'>

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDataCacheDb()
  try {
    const tx = db.transaction(store, mode)
    return await promisify(fn(tx.objectStore(store)))
  }
  finally {
    db.close()
  }
}

/** The pending entry for an entity, or `undefined` if none is queued. */
export function getEntry(entityId: string): Promise<WriteQueueEntry | undefined> {
  return withStore(QUEUE_STORE, 'readonly', s => s.get(entityId) as IDBRequest<WriteQueueEntry | undefined>)
}

/** All pending entries in cross-entity drain order (ascending `seq`) — replay walks this (DC3). */
export async function peekAllOrdered(): Promise<WriteQueueEntry[]> {
  const all = await withStore(QUEUE_STORE, 'readonly', s => s.getAll() as IDBRequest<WriteQueueEntry[]>)
  return all.sort((a, b) => a.seq - b.seq)
}

/** Drop an entry (successful replay, or annihilated create+delete, or discard). */
export function remove(entityId: string): Promise<undefined> {
  return withStore(QUEUE_STORE, 'readwrite', s => s.delete(entityId) as IDBRequest<undefined>)
}

/** `attempts++` after a transient replay failure — feeds the backoff/dead-letter cap (DC9). */
export async function bumpAttempt(entityId: string): Promise<void> {
  const entry = await getEntry(entityId)
  if (!entry)
    return
  entry.attempts += 1
  await withStore(QUEUE_STORE, 'readwrite', s => s.put(entry) as IDBRequest<IDBValidKey>)
}

/** Move a permanently-failed entry to the dead-letter store so it stops blocking the drain (DC9). */
export async function deadLetter(entityId: string, reason: 'conflict' | 'permanent' | 'transient' = 'permanent'): Promise<void> {
  const db = await openDataCacheDb()
  try {
    const tx = db.transaction([QUEUE_STORE, DEAD_LETTER_STORE], 'readwrite')
    const entry = await promisify(tx.objectStore(QUEUE_STORE).get(entityId) as IDBRequest<WriteQueueEntry | undefined>)
    if (entry) {
      entry.deadReason = reason
      tx.objectStore(DEAD_LETTER_STORE).put(entry)
      tx.objectStore(QUEUE_STORE).delete(entityId)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  finally {
    db.close()
  }
}

/** Count of pending (not dead-lettered) entries — drives the durable pending-sync indicator (8.1). */
export function countPending(): Promise<number> {
  return withStore(QUEUE_STORE, 'readonly', s => s.count() as IDBRequest<number>)
}

/** All dead-lettered entries for the review surface (8.2). */
export function listDeadLetters(): Promise<WriteQueueEntry[]> {
  return withStore(DEAD_LETTER_STORE, 'readonly', s => s.getAll() as IDBRequest<WriteQueueEntry[]>)
}

/**
 * Discard a dead-lettered entry (8.2): give up on the write.
 * // ponytail: does NOT revert the optimistic entity cache — the stale edit self-heals
 * on the next `cachedLoad` refetch (imminent, since the user is online to see this surface).
 * Add a cache-revert-from-baseSnapshot path only if a discard must show instantly offline.
 */
export function discardDeadLetter(entityId: string): Promise<undefined> {
  return withStore(DEAD_LETTER_STORE, 'readwrite', s => s.delete(entityId) as IDBRequest<undefined>)
}

/** Retry a dead-lettered entry (8.2): move it back to the live queue with a fresh attempt budget. */
export async function retryDeadLetter(entityId: string): Promise<void> {
  const db = await openDataCacheDb()
  try {
    const tx = db.transaction([DEAD_LETTER_STORE, QUEUE_STORE], 'readwrite')
    const entry = await promisify(
      tx.objectStore(DEAD_LETTER_STORE).get(entityId) as IDBRequest<WriteQueueEntry | undefined>,
    )
    if (entry) {
      entry.attempts = 0
      tx.objectStore(QUEUE_STORE).put(entry)
      tx.objectStore(DEAD_LETTER_STORE).delete(entityId)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  finally {
    db.close()
  }
}

const QUOTA_SAFETY = 0.9

/**
 * Refuse enqueue if IndexedDB is near quota rather than corrupt the queue (DC9 /
 * GPX-blob risk). Same `navigator.storage.estimate()` pattern as offline-map-support
 * + offline-app-cache-sync. `projectedBytes` ≈ blob sizes + a JSON overhead slack.
 *
 * // ponytail: plain Error, not a typed class — core/ must not import the map
 * feature's OfflineQuotaError (layering). Promote to a core exception if a second
 * caller needs to branch on the type.
 */
export async function assertQueueHeadroom(projectedBytes: number): Promise<void> {
  const est = await navigator.storage?.estimate?.()
  if (!est || est.quota == null)
    return
  const free = est.quota * QUOTA_SAFETY - (est.usage ?? 0)
  if (projectedBytes > free)
    throw new Error('offline-queue-storage-full')
}

/**
 * Fold an incoming offline mutation into an entity's pending queue entry (DC1).
 * Pure — no IDB, no clock. Returns the next entry, or null to ANNIHILATE.
 * Preserves existing.seq when folding; a brand-new entry keeps incoming's seq.
 *
 *   (none) + create → op=create           create + delete → null (annihilate)
 *   (none) + update → op=update           update + update → newer payload, keep-first baseline
 *   (none) + delete → op=delete tombstone update + delete → op=delete tombstone
 *   create + update → newer payload, stays op=create
 *   delete + (any)  → terminal (UUIDs never reused)
 */
export function coalesce(
  existing: WriteQueueEntry | undefined,
  incoming: WriteQueueEntry,
): WriteQueueEntry | null {
  // Always creates new entry
  if (existing === undefined) {
    return { ...incoming }
  }
  // Existing deletes cannot be reverted (UUIDs are not reused)
  if (existing.op === 'delete') {
    return { ...existing }
  }

  if (incoming.op === 'delete') {
    if (existing.op === 'create') {
      return null
    }
    else {
      return { ...existing, attempts: 0, op: 'delete' }
    }
  }

  // Merge existing and incoming write ops
  return { ...existing, attempts: 0, payload: incoming.payload, blobs: incoming.blobs }
}
