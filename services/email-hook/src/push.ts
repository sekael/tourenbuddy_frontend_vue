import type { PushSubscription, VapidKeys } from '@block65/webcrypto-web-push'
import type { Env } from './config'
import { buildPushPayload } from '@block65/webcrypto-web-push'

export interface PushPayload {
  title: string
  body: string
  url: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Sends a push notification to a single subscription.
 * Returns the HTTP status from the push service (201 = delivered, 410/404 = stale).
 */
export async function sendPushNotification(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
  env: Env,
): Promise<number> {
  const vapid: VapidKeys = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  const pushSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }

  let pushPayload
  try {
    pushPayload = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 60 * 60 * 24 } },
      pushSubscription,
      vapid,
    )
  }
  catch (err) {
    console.error('[push] buildPushPayload failed:', (err as Error).message)
    throw err
  }

  const res = await fetch(subscription.endpoint, pushPayload)
  const bodyText = res.ok ? '' : await res.text().catch(() => '')
  console.log('[push] status', res.status, subscription.endpoint.slice(0, 80), bodyText.slice(0, 200))
  return res.status
}

/** Deletes a stale push subscription row by endpoint. */
export async function deleteStaleSubscription(endpoint: string, env: Env): Promise<void> {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
}

/** Dispatches push to all subscriptions for a user. Cleans up stale endpoints on 404/410. */
export async function dispatchPushToUser(
  userId: string,
  payload: PushPayload,
  env: Env,
): Promise<void> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )

  if (!res.ok)
    return

  const subscriptions = (await res.json()) as PushSubscriptionRow[]

  await Promise.all(
    subscriptions.map(async (sub) => {
      const status = await sendPushNotification(sub, payload, env)
      if (status === 404 || status === 410) {
        await deleteStaleSubscription(sub.endpoint, env)
      }
    }),
  )
}
