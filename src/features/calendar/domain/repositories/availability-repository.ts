/**
 * Own-availability persistence. Days are `dayKey` strings (`YYYY-MM-DD`).
 *
 * Friend availability is intentionally absent — that is #244.
 */
export interface AvailabilityRepository {
  /** Own available days from `fromDate` (inclusive) onward. */
  listOwnFrom: (fromDate: string) => Promise<string[]>
  /** Atomically insert `added` days and delete `removed` days for the caller. */
  applyDiff: (added: string[], removed: string[]) => Promise<void>
}
