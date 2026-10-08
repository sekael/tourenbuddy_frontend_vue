import type { PushSubscriptionRepository } from '../../domain/repositories/push-subscription-repository'
import { env } from '@/core/constants/env'
import { useLogger } from '@/core/logging/use-logger'
import { PushSubscriptionRepositoryImpl } from '../../data/repositories/push-subscription-repository-impl'

const defaultRepository = new PushSubscriptionRepositoryImpl()

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Web Push for THIS browser only (#148). Push is a per-device setting: the source of truth
 * is the browser's own PushManager subscription, mirrored as one `push_subscriptions` row.
 * Nothing here touches another device's row.
 */
export function useWebPush(repository: PushSubscriptionRepository = defaultRepository) {
  const logger = useLogger('useWebPush')

  /** This browser's live subscription, or null when push is off / unsupported here. */
  async function currentSubscription(): Promise<PushSubscription | null> {
    if (!supported() || Notification.permission !== 'granted')
      return null
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  }

  async function register(subscription: PushSubscription): Promise<void> {
    const keys = subscription.toJSON().keys ?? {}
    await repository.register({
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
      userAgent: navigator.userAgent,
    })
  }

  async function subscribe(): Promise<boolean> {
    if (!supported()) {
      logger.warn('Web Push not supported')
      return false
    }

    // Optional env var: absent when the deploy has notifications enabled but no VAPID
    // key wired. `subscribe()` would throw on an undefined applicationServerKey.
    const vapidKey = env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      logger.warn('VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe to Web Push')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted')
        return false

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
      await register(subscription)
      return true
    }
    catch (err) {
      logger.error('Failed to subscribe to push', err)
      return false
    }
  }

  /** Disable push on this device only: drop its row, then the browser subscription. Never throws. */
  async function unsubscribe(): Promise<void> {
    let subscription: PushSubscription | null = null
    try {
      subscription = await currentSubscription()
    }
    catch (err) {
      logger.error('Failed to read browser push subscription', err)
    }
    if (!subscription)
      return

    try {
      await repository.removeSubscription(subscription.endpoint)
    }
    catch (err) {
      logger.error('Failed to remove this device\'s push subscription row', err)
    }
    try {
      await subscription.unsubscribe()
    }
    catch (err) {
      logger.error('Failed to unsubscribe browser from push', err)
    }
  }

  /**
   * On app start: if this browser is subscribed, (re-)register its row. Heals a row the
   * Worker deleted after a 410 and re-owns an endpoint another account left behind.
   * Returns whether this device has push on.
   */
  async function ensureSubscription(): Promise<boolean> {
    try {
      const subscription = await currentSubscription()
      if (!subscription)
        return false
      await register(subscription)
      return true
    }
    catch (err) {
      logger.error('Failed to ensure push subscription', err)
      return false
    }
  }

  return { subscribe, unsubscribe, ensureSubscription, currentSubscription }
}

// `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>` — only the
// former satisfies `BufferSource` for `applicationServerKey` under TS 5.7+.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
