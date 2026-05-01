import { ref } from 'vue'

export interface SnackbarState {
  visible: boolean
  message: string
}

/**
 * Composable for showing temporary snackbar notifications.
 * Typically used at the page/layout level and passed down via provide/inject.
 */
export function useSnackbar(duration = 4000) {
  const snackbar = ref<SnackbarState>({ visible: false, message: '' })
  let timer: ReturnType<typeof setTimeout> | null = null

  function show(message: string) {
    if (timer) clearTimeout(timer)
    snackbar.value = { visible: true, message }
    timer = setTimeout(() => {
      snackbar.value.visible = false
    }, duration)
  }

  function dismiss() {
    if (timer) clearTimeout(timer)
    snackbar.value.visible = false
  }

  return { snackbar, show, dismiss }
}
