// Extension point: add 'tour_invites' | 'tour_updates' etc. here when needed.
// Each new value requires only a TS union entry + i18n keys — no DB migration needed
// (notif_muted_types is a text[] column).
export type NotificationType = 'friend_requests'

export const ALL_NOTIFICATION_TYPES: NotificationType[] = ['friend_requests']

export interface NotificationPreferences {
  notifPushEnabled: boolean
  notifEmailEnabled: boolean
  notifMutedTypes: NotificationType[]
}
