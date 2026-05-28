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

/**
 * Fire-and-forget: after a successful tour create/update, ask the Worker to scan
 * for friend-owned colliding tours (same goal within 100 m, same `tour_type`, both
 * friends-visible) and dispatch a `tour_interest` notification to each colliding
 * owner. Replaces the legacy "decline duplicate save → signal interest" flow.
 */
export function notifyTourInterest(tourId: string): void {
  postToWorker('/notify/tour-interest', { tourId }).catch((err) => {
    logger.warn('notifyTourInterest failed', err)
  })
}

/**
 * Fire-and-forget: notify the counterparty of a tour-link-request lifecycle event.
 * Withdrawals SHALL NOT call this (per design — silent for the target).
 */
export function notifyTourLinkRequestEvent(
  requestId: string,
  event: 'created' | 'accepted' | 'declined',
): void {
  postToWorker('/notify/link-request-event', { requestId, event }).catch((err) => {
    logger.warn('notifyTourLinkRequestEvent failed', err)
  })
}

/**
 * Fire-and-forget: notify group members of a membership change. Worker resolves
 * recipients per the design's group-membership notification matrix (joined →
 * pre-existing members; evicted_external → evicted + remaining; dissolved →
 * lone remaining member). The actor is suppressed by the Worker via JWT match.
 */
export function notifyGroupMembershipEvent(
  groupId: string,
  event: 'joined' | 'evicted_external' | 'dissolved',
  detail: { actorTourId?: string, affectedTourId?: string, affectedUserId?: string } = {},
): void {
  postToWorker('/notify/group-membership-event', { groupId, event, ...detail }).catch((err) => {
    logger.warn('notifyGroupMembershipEvent failed', err)
  })
}
