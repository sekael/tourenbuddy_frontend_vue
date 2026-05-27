import { env } from '@/core/constants/env'
import { useLogger } from '@/core/logging/use-logger'
import { supabase } from '@/core/utils/supabase'

const logger = useLogger('NotifyDispatch')

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function postToWorker(path: string, body: Record<string, unknown>): Promise<void> {
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
      body: JSON.stringify(body),
    })
  }
  catch (err) {
    logger.warn('Notification dispatch failed (non-critical)', err)
  }
}

/** Fire-and-forget: notify recipient of incoming friend request. */
export function notifyFriendRequestReceived(friendshipId: string): void {
  postToWorker('/notify/friend-request-received', { friendshipId }).catch((err) => {
    logger.warn('notifyFriendRequestReceived failed', err)
  })
}

/** Fire-and-forget: notify requester that their request received a response. */
export function notifyFriendRequestResponded(friendshipId: string): void {
  postToWorker('/notify/friend-request-responded', { friendshipId }).catch((err) => {
    logger.warn('notifyFriendRequestResponded failed', err)
  })
}

export type TourChangeAction = 'created' | 'updated' | 'deleted'

/**
 * Fire-and-forget: notify friend partners that a shared tour was created/updated.
 * The Worker resolves recipients (tour partner users ∩ owner's friends, minus the
 * actor) by reading the still-live tour row, so the client only sends id + action.
 */
export function notifyTourChanged(tourId: string, action: Exclude<TourChangeAction, 'deleted'>): void {
  postToWorker('/notify/tour-changed', { tourId, action }).catch((err) => {
    logger.warn('notifyTourChanged failed', err)
  })
}

/**
 * Fire-and-forget: notify friend partners that a shared tour was deleted. Fired AFTER
 * the row is gone, so the tour can no longer be read; the client passes the partner
 * contact ids it cached pre-delete and the Worker re-resolves recipients from the
 * surviving contact_methods/friendships (see users_by_contact_ids migration).
 */
export function notifyTourDeleted(partnerContactIds: string[], tourName: string): void {
  postToWorker('/notify/tour-changed', { action: 'deleted', partnerContactIds, tourName }).catch((err) => {
    logger.warn('notifyTourDeleted failed', err)
  })
}

/** Fire-and-forget: notify a tour's owner that the caller is interested in it. */
export function notifyTourInterest(tourId: string): void {
  postToWorker('/notify/tour-interest', { tourId }).catch((err) => {
    logger.warn('notifyTourInterest failed', err)
  })
}
