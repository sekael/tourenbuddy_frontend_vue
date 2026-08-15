import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { ref } from 'vue'
import {
  bumpAttempt,
  deadLetter,
  peekAllOrdered,
  remove,
} from '@/core/offline/write-queue'

/**
 * Drains the durable write queue on reconnect (change: offline-write-sync, DC3):
 * re-dispatch each coalesced entry to its registered replay handler, in `seq`
 * order (cross-entity FK order), re-running the same online path the action would.
 *
 * A handler makes ONE idempotent server call selected by `entry.op` (create →
 * `create_tour_full` ON CONFLICT DO NOTHING, update → update-only `update_tour_full`,
 * delete → delete) + deferred notify (DC6). It resolves on success, throws
 * `PermanentReplayError` for a failure that must NOT be retried (validation / RLS /
 * 404 / LWW-loser), and throws anything else for a transient failure (network / 5xx).
 *
 * The drain never lets one bad entry block the rest (no head-of-line stall, DC9) and
 * exposes a single-flight promise so the reconnect refetch can gate on it (DC4).
 */

export type ReplayHandler = (entry: WriteQueueEntry) => Promise<void>

/** Thrown by a handler for a failure that must dead-letter immediately, not retry (DC9). */
export class PermanentReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentReplayError'
  }
}

const handlers = new Map<string, ReplayHandler>()

/** Bumped after each drain so the queue-status UI can refresh its counts. */
export const drainedAt = ref(0)

/** Stores call this at init to wire their `kind` to a replay handler (DC3). */
export function registerReplay(kind: string, handler: ReplayHandler): void {
  handlers.set(kind, handler)
}

/** Test seam — drop all registered handlers. */
export function clearReplayHandlers(): void {
  handlers.clear()
}

/** Give up on an entry after this many attempts; a transient failure past it is permanent (DC9). */
const MAX_ATTEMPTS = 5

/** Capped exponential backoff + jitter for the next retry sweep (DC9). */
function backoff(attempts: number): number {
  const base = Math.min(1000 * 2 ** (attempts - 1), 30_000)
  return base + Math.random() * 1000
}

function scheduleRetry(delayMs: number): void {
  setTimeout(() => void replayQueue(), delayMs)
}

/**
 * Cross-entity dependency cascade (DC9): a create that dead-letters strands any
 * pending entry that references the never-created row (e.g. a tour whose partnerIds
 * include an offline-created contact that failed) — replaying it would 404.
 *
 * // ponytail: substring scan of the serialized payload for a dead entity id — UUIDs
 * are long + unique so false positives are ~nil. Upgrade to an explicit `entry.deps[]`
 * if a non-UUID id ever rides in a payload.
 */
function referencesDeadEntity(entry: WriteQueueEntry, deadIds: Set<string>): boolean {
  if (deadIds.size === 0)
    return false
  const serialized = JSON.stringify(entry.payload)
  return [...deadIds].some(id => serialized.includes(id))
}

async function runDrain(): Promise<void> {
  const entries = await peekAllOrdered()
  const deadIds = new Set<string>()
  let nextRetryDelay = Number.POSITIVE_INFINITY
  const kill = async (id: string, reason: 'conflict' | 'permanent' = 'permanent') => {
    await deadLetter(id, reason)
    deadIds.add(id)
  }

  for (const entry of entries) {
    // Cascade: a referenced create already dead-lettered → this dependent can't land (DC9).
    if (referencesDeadEntity(entry, deadIds)) {
      await kill(entry.entityId)
      continue
    }

    const handler = handlers.get(entry.kind)
    if (!handler) {
      await kill(entry.entityId)
      continue
    }

    try {
      await handler(entry)
      await remove(entry.entityId)
    }
    catch (err) {
      if (err instanceof PermanentReplayError || entry.attempts + 1 >= MAX_ATTEMPTS) {
        // LWW losers throw PermanentReplayError with an "LWW loser" message (DC5) — tag them
        // 'conflict' so the dead-letter surface shows the conflict copy, not a generic failure.
        const reason = err instanceof PermanentReplayError && /LWW/i.test(err.message) ? 'conflict' : 'permanent'
        await kill(entry.entityId, reason)
      }
      else {
        await bumpAttempt(entry.entityId)
        nextRetryDelay = Math.min(nextRetryDelay, backoff(entry.attempts + 1))
      }
    }
  }

  // A transient failure remained → schedule one backed-off retry sweep (no polling loop, DC7).
  if (nextRetryDelay !== Number.POSITIVE_INFINITY)
    scheduleRetry(nextRetryDelay)

  drainedAt.value = Date.now() // nudge the pending-sync / dead-letter UI to re-read (8.1/8.2)
}

let drain: Promise<void> | null = null

/**
 * Kickstart a drain, or join the one already running (single-flight). The returned
 * promise IS the DC4 `replayDone` gate: the reconnect `onSubscribed` refetch awaits
 * it so the flush completes before the server snapshot overwrites the store.
 */
export function replayQueue(): Promise<void> {
  if (!drain)
    drain = runDrain().finally(() => { drain = null })
  return drain
}
