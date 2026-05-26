// Each value requires only a TS union entry + i18n keys — no DB migration needed
// (notif_muted_types is a text[] column).
//  - tour_updates:  a shared tour you partner on was created / changed / deleted
//  - tour_interest: a friend is interested in your tour (declined a duplicate save)
export type NotificationType = 'friend_requests' | 'tour_updates' | 'tour_interest'

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'friend_requests',
  'tour_updates',
  'tour_interest',
]

export interface NotificationPreferences {
  notifPushEnabled: boolean
  notifEmailEnabled: boolean
  notifMutedTypes: NotificationType[]
}
