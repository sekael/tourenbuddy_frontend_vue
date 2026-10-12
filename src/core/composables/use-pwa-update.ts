import type { ComputedRef, Ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { computed, ref } from 'vue'
import { isOnline } from '@/core/offline/use-online-status'

/** Foreground update checks closer together than this are skipped. */
export const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

export interface PwaUpdate {
  /** A newer build is installed and waiting; only applying it clears this. */
  updateAvailable: Ref<boolean>
  /** The banner: pending update not dismissed during this app start. */
  showBanner: ComputedRef<boolean>
  apply: () => void
  dismissBanner: () => void
}

// One registration for the whole app: the banner, the profile notice and the speed-dial
// dots all read the same state, and each extra registration would add another reload
// listener.
let instance: PwaUpdate | null = null

function create(): PwaUpdate {
  let registration: ServiceWorkerRegistration | undefined
  let lastCheck = Number.NEGATIVE_INFINITY
  let reloading = false

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg
      // Registering doesn't re-fetch sw.js by itself, so check explicitly on app start.
      checkForUpdate()
    },
  })
  const bannerDismissed = ref(false)

  function checkForUpdate() {
    if (!registration || !isOnline.value || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS)
      return
    lastCheck = Date.now()
    registration.update().catch(() => {})
  }

  function reload() {
    if (reloading)
      return
    reloading = true
    window.location.reload()
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Hidden windows that saw the waiting update are reloaded by vite-plugin-pwa itself.
      if (document.visibilityState === 'visible')
        reload()
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible')
      return
    // Only when the user looks at the app: a hidden PWA's timers are suspended anyway.
    checkForUpdate()
  })

  return {
    updateAvailable: needRefresh,
    showBanner: computed(() => needRefresh.value && !bannerDismissed.value),
    apply: () => {
      // The waiting worker already holds the full precache, so this works offline too.
      void updateServiceWorker()
    },
    dismissBanner: () => {
      bannerDismissed.value = true
    },
  }
}

export function usePwaUpdate(): PwaUpdate {
  return (instance ??= create())
}
