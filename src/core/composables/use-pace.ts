import { ref } from 'vue'

/** The pace slider's range, a speed factor on the rule of thumb: tortoise to hare. */
export const PACE_MIN = 0.5
export const PACE_MAX = 1.5
export const PACE_STEP = 0.1

/** A pace as a factor with one decimal and its times sign ("1.2×", owner). */
export const formatPace = (value: number) => `${value.toFixed(1)}×`

/**
 * The user's pace for every time the app estimates, as in the swisstopo app: the same for every
 * tour. The user feature keeps it on the profile, so it follows the account to every device.
 */
export const pace = ref(1)
