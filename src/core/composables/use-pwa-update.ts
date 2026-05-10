import { useRegisterSW } from 'virtual:pwa-register/vue'

let reloading = false

export function usePwaUpdate() {
  const { needRefresh, updateSW } = useRegisterSW({ immediate: true })

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
    reloading = true
    updateSW(true)
  }

  function dismiss() {
    needRefresh.value = false
  }

  return { needRefresh, accept, dismiss }
}
