import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Cross-overlay signal so a sibling overlay (the profile sheet's "Show app
 * tour" action) can ask `map-page.vue` — which owns the tour controller — to
 * (re)open the tour, without threading events through the overlay container.
 *
 * `reopenSignal` is a monotonically increasing counter; `map-page` watches it
 * and starts the tour on each bump. A counter (not a boolean) guarantees a
 * fresh watch trigger even if the user reopens twice in a row.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const reopenSignal = ref(0)

  function requestReopen() {
    reopenSignal.value += 1
  }

  return { reopenSignal, requestReopen }
})
