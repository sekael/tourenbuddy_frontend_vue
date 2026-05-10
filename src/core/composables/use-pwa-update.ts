import { useRegisterSW } from 'virtual:pwa-register/vue'

let reloading = false

export function usePwaUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading)
        return
      if (document.visibilityState === 'visible') {
        reloading = true
        window.location.reload()
      }
    })
  }

  function accept() {
    updateServiceWorker()
  }

  function dismiss() {
    needRefresh.value = false
  }

  return { needRefresh, accept, dismiss }
}
