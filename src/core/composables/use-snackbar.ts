import { ref, shallowRef, watch } from 'vue'

export interface SnackbarState {
  visible: boolean
  message: string
}

// Every transient bottom message shares one spot. Showing one claims the slot and
// hides whichever message held it, so two never render on top of each other.
const slot = shallowRef<object | null>(null)

/**
 * Join the app-wide snackbar slot: `hide` runs when another message claims it.
 * Call the returned function when showing your message.
 */
export function useSnackbarSlot(hide: () => void): () => void {
  const owner = {}
  watch(slot, (current) => {
    if (current !== owner)
      hide()
  })
  return () => {
    slot.value = owner
  }
}

/**
 * Composable for showing temporary snackbar notifications.
 * Typically used at the page/layout level and passed down via provide/inject.
 */
export function useSnackbar(duration = 4000) {
  const snackbar = ref<SnackbarState>({ visible: false, message: '' })
  let timer: ReturnType<typeof setTimeout> | null = null

  function dismiss() {
    if (timer)
      clearTimeout(timer)
    snackbar.value.visible = false
  }

  const claim = useSnackbarSlot(dismiss)

  function show(message: string) {
    if (timer)
      clearTimeout(timer)
    claim()
    snackbar.value = { visible: true, message }
    timer = setTimeout(() => {
      snackbar.value.visible = false
    }, duration)
  }

  return { snackbar, show, dismiss }
}
