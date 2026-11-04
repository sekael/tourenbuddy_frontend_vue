import type { LocationResult, PickRole } from '@/features/map/data/services/swisstopo-search-service'
import { watchDebounced } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'
import { rankResults, searchLocations } from '@/features/map/data/services/swisstopo-search-service'

interface SearchOptions {
  locale: () => string
  /** What is picked: a start or end point also finds stops and ranks access places first. */
  role: () => PickRole | undefined
  /** Where the user looks (and how close): same-named places rank nearest first. Null: no answer wanted. */
  origin: () => { center: { lng: number, lat: number }, zoom: number } | null
}

/**
 * The place search of a location pick (the crosshair picker, the route planner): debounced, the
 * latest query only, and a chosen result's name is not searched again.
 */
export function useLocationSearch({ locale, role, origin }: SearchOptions) {
  const query = ref('')
  const results = ref<LocationResult[]>([])
  const failed = ref(false)
  const listOpen = ref(false)
  /** The last result chosen; its name is in the field. */
  const chosen = ref<LocationResult | null>(null)

  /**
   * Every run replaces `controller` first — even one that returns early — so an older
   * request is aborted, and any answer it still delivers fails the `controller !== own` check.
   */
  let controller: AbortController | null = null

  watchDebounced(query, async (q) => {
    controller?.abort()
    const own = new AbortController()
    controller = own

    const trimmed = q.trim()
    if (trimmed.length < 2) {
      listOpen.value = false
      return
    }
    // The chosen result's name was written into the field — no need to search it again.
    if (chosen.value?.name === trimmed)
      return

    try {
      const found = await searchLocations(trimmed, locale(), own.signal, role())
      const at = origin()
      if (controller !== own || !at)
        return
      results.value = rankResults(found, at.center, at.zoom, role())
      failed.value = false
    }
    catch (err) {
      // Superseded or aborted on purpose: stay silent, the newer run owns the list.
      if (controller !== own || (err instanceof DOMException && err.name === 'AbortError'))
        return
      results.value = []
      failed.value = true
    }
    // Not `finally`: that would also run on the silent returns above and open the list.
    listOpen.value = true
  }, { debounce: 300 })
  onBeforeUnmount(() => controller?.abort())

  // Clearing the field also forgets the chosen result (no stale name on confirm).
  watch(query, (q) => {
    if (!q.trim())
      chosen.value = null
  })

  /** Take `result`: its name goes into the field, the list closes. */
  function take(result: LocationResult) {
    chosen.value = result
    query.value = result.name
    listOpen.value = false
  }

  return { query, results, failed, listOpen, chosen, take }
}
