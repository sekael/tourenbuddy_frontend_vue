import type { Ref } from 'vue'
import { onScopeDispose, reactive, ref } from 'vue'

/**
 * A point confirmed in the location picker or the route planner; `name` when it came from a
 * search or the planner's lookup, `elevation` when the planner looked it up (null: it couldn't).
 */
export interface PointPick {
  type: 'goal' | 'start' | 'end'
  location: { lng: number, lat: number }
  name?: string
  elevation?: number | null
}

/** The route planner's Done: a moved point, or a start / end it removed (map-first-tour-creation D3). */
export type PointChange = PointPick | { type: 'start' | 'end', location: null }

export type SwisstopoFillStatus = 'idle' | 'loading' | 'failed'

/**
 * One form field Swisstopo fills after a location pick. What the user typed is theirs: a
 * pick skips the field, and typing mid-lookup cancels the request, so no answer — however
 * late — overwrites it. Values the form was seeded with or filled itself follow the next pick.
 */
export function useSwisstopoFill(field: Ref<string>) {
  const status = ref<SwisstopoFillStatus>('idle')
  let typed = false
  let controller: AbortController | null = null

  /** Stop waiting; a late answer then fails the `controller !== own` check. */
  function cancel() {
    controller?.abort()
    controller = null
    status.value = 'idle'
  }

  /** Bound to the field's `input` event (typing, paste, autofill, number steppers). */
  function input() {
    typed = true
    cancel()
  }

  /** A value already known (the planner looked it up) lands at once: nothing in between to wait for. */
  async function fill(lookup: (signal: AbortSignal) => Promise<string | number | null> | string | number | null) {
    if (typed && field.value.trim())
      return
    cancel()
    const own = new AbortController()
    controller = own
    typed = false
    const answer = lookup(own.signal)
    if (answer instanceof Promise) {
      // The old value described the previous point — show the wait, not a stale answer.
      field.value = ''
      status.value = 'loading'
    }
    const value = answer instanceof Promise ? await answer : answer
    if (controller !== own)
      return
    controller = null
    field.value = value == null ? '' : String(value)
    status.value = value == null ? 'failed' : 'idle'
  }

  onScopeDispose(cancel)
  return reactive({ status, fill, input, cancel })
}

export type SwisstopoFill = ReturnType<typeof useSwisstopoFill>
