import { computed } from 'vue'

function isIos(): boolean {
  return /ipad|iphone|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

/**
 * Returns push capability flags.
 * - `pushSupported`: browser supports Web Push and permission can be requested
 * - `requiresPwaInstall`: iOS Safari outside a standalone (installed) PWA
 */
export function useNotificationCapability() {
  const requiresPwaInstall = computed<boolean>(() => isIos() && !isStandalone())
  const pushSupported = computed<boolean>(() => 'PushManager' in window && 'serviceWorker' in navigator && !requiresPwaInstall.value)

  return { pushSupported, requiresPwaInstall }
}
