import { env } from '@/core/constants/env'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'

const logger = useLogger('NotifyDispatch')

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function postToWorker(path: string, friendshipId: string): Promise<void> {
  if (!env.VITE_NOTIFICATIONS_ENABLED || !env.VITE_NOTIFY_HOOK_URL)
    return

  const token = await getAccessToken()
  if (!token)
    return

  try {
    await fetch(`${env.VITE_NOTIFY_HOOK_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ friendshipId }),
    })
  }
  catch (err) {
    logger.warn('Notification dispatch failed (non-critical)', err)
  }
}

/** Fire-and-forget: notify recipient of incoming friend request. */
export function notifyFriendRequestReceived(friendshipId: string): void {
  postToWorker('/notify/friend-request-received', friendshipId).catch((err) => {
    logger.warn('notifyFriendRequestReceived failed', err)
  })
}

/** Fire-and-forget: notify requester that their request received a response. */
export function notifyFriendRequestResponded(friendshipId: string): void {
  postToWorker('/notify/friend-request-responded', friendshipId).catch((err) => {
    logger.warn('notifyFriendRequestResponded failed', err)
  })
}
