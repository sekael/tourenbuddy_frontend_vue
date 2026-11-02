import { ref, watch } from 'vue'

const PACE_STORAGE_KEY = 'tb.pace'

/** The pace slider's range in percent of the rule of thumb's speed: tortoise to hare. */
export const PACE_MIN = 50
export const PACE_MAX = 150
export const PACE_STEP = 10

function readStoredPace(): number {
  try {
    const stored = Number(localStorage.getItem(PACE_STORAGE_KEY))
    if (stored >= PACE_MIN && stored <= PACE_MAX)
      return stored
  }
  catch {
    // localStorage unavailable — the standard pace.
  }
  return 100
}

/**
 * The user's pace for every time the app estimates, as in the swisstopo app: kept per device, like
 * the map's layers, and the same for every tour.
 * ponytail: per device; a profile column if users want it on all their devices.
 */
export const pace = ref(readStoredPace())

watch(pace, (value) => {
  try {
    localStorage.setItem(PACE_STORAGE_KEY, String(value))
  }
  catch {
    // Not persisted this time; the in-memory pace still applies.
  }
})
