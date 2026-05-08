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

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted')
        return false

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.VITE_VAPID_PUBLIC_KEY),
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

  async function unsubscribe(): Promise<void> {
    if (!('serviceWorker' in navigator))
      return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription)
        return

      await repository.removeSubscription(subscription.endpoint)
      await subscription.unsubscribe()
    }
    catch (err) {
      logger.error('Failed to unsubscribe from push', err)
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
