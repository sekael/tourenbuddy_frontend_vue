import type { WriteQueueEntry } from '@/core/offline/write-queue'
import { ref } from 'vue'
import { replayQueue } from '@/core/offline/replay'
import {
  countPending,
  discardDeadLetter,
  listDeadLetters,
  retryDeadLetter,
} from '@/core/offline/write-queue'

/**
 * Reactive view of the durable write queue for the offline-sync UI (section 8). Read
 * from IndexedDB on every launch (even offline) so unsynced work is always visible —
 * not a transient toast (DC7 replay-trigger ceiling). Refreshed on enqueue, after each
 * drain, and after a retry/discard.
 */
export const pendingCount = ref(0)
export const deadLetters = ref<WriteQueueEntry[]>([])

export async function refreshQueueStatus(): Promise<void> {
  const [count, dead] = await Promise.all([countPending(), listDeadLetters()])
  pendingCount.value = count
  deadLetters.value = dead
}

/** Retry a dead-lettered write: requeue it, kick a drain, then re-read. */
export async function retryDeadLettered(entityId: string): Promise<void> {
  await retryDeadLetter(entityId)
  await refreshQueueStatus()
  void replayQueue().finally(refreshQueueStatus)
}

/** Discard a dead-lettered write: give up on it and re-read. */
export async function discardDeadLettered(entityId: string): Promise<void> {
  await discardDeadLetter(entityId)
  await refreshQueueStatus()
}
