import { env } from '@/core/constants/env'
import { useLogger } from '@/core/logging/use-logger'
import { PushSubscriptionRepositoryImpl } from '../../data/repositories/push-subscription-repository-impl'

const repository = new PushSubscriptionRepositoryImpl()

export function useWebPush() {
  const logger = useLogger('useWebPush')

  async function subscribe(userId: string): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
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
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const keys = subscription.toJSON().keys ?? {}
      await repository.upsertSubscription(userId, {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh ?? '',
        auth: keys.auth ?? '',
        userAgent: navigator.userAgent,
      })

      return true
    }
    catch (err) {
      logger.error('Failed to subscribe to push', err)
      return false
    }
  }

  async function unsubscribe(userId: string): Promise<void> {
    try {
      await repository.removeAllForUser(userId)
    }
    catch (err) {
      logger.error('Failed to remove push subscription rows', err)
    }

    if (!('serviceWorker' in navigator))
      return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription)
        await subscription.unsubscribe()
    }
    catch (err) {
      logger.error('Failed to unsubscribe browser from push', err)
    }
  }

  async function ensureSubscription(userId: string): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window))
      return
    if (Notification.permission !== 'granted')
      return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription)
        return

      const keys = subscription.toJSON().keys ?? {}
      await repository.upsertSubscription(userId, {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh ?? '',
        auth: keys.auth ?? '',
        userAgent: navigator.userAgent,
      })
    }
    catch (err) {
      logger.error('Failed to ensure push subscription', err)
    }
  }

  return { subscribe, unsubscribe, ensureSubscription }
}

// `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>` — only the
// former satisfies `BufferSource` for `applicationServerKey` under TS 5.7+.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
