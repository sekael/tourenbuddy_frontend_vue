import type { NotificationPreferences, NotificationType } from '../../domain/entities/notification-preferences'
import { z } from 'zod'
import { ALL_NOTIFICATION_TYPES } from '../../domain/entities/notification-preferences'

const knownTypeSet = new Set<string>(ALL_NOTIFICATION_TYPES)

export const notificationPreferencesRowSchema = z
  .object({
    notif_push_enabled: z.boolean(),
    notif_email_enabled: z.boolean(),
    notif_muted_types: z.array(z.string()),
  })
  .transform((row): NotificationPreferences => ({
    notifPushEnabled: row.notif_push_enabled,
    notifEmailEnabled: row.notif_email_enabled,
    notifMutedTypes: row.notif_muted_types.filter((t): t is NotificationType =>
      knownTypeSet.has(t),
    ),
  }))
