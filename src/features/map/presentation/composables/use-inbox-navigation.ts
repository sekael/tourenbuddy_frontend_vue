import type { InboxNotification } from '@/features/notifications/domain/entities/inbox-notification'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSnackbar } from '@/core/composables/use-snackbar'
import { useInboxStore } from '@/features/notifications/presentation/stores/inbox-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/**
 * Where an inbox entry leads (D7: entries are static, acting happens on the subject).
 * Shared by a tap in the inbox and by the `?notification=<id>` link every push/email
 * carries, so routing lives in ONE place instead of per-channel URLs.
 */
export function useInboxNavigation(open: {
  overlay: (name: 'friend-requests' | 'contacts') => void
  tour: (tourId: string) => void
}) {
  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const inboxStore = useInboxStore()
  const toursStore = useToursStore()
  const snackbar = useSnackbar()

  function openEntry(entry: InboxNotification) {
    if (entry.action === 'received') {
      open.overlay('friend-requests')
      return
    }
    if (entry.action === 'responded') {
      open.overlay('contacts')
      return
    }
    const friendshipId = entry.ref.friendship_id
    if (entry.action === 'backfill' && typeof friendshipId === 'string') {
      router.push({ name: 'backfill-collisions', params: { friendshipId } })
      return
    }
    const visible = entry.tourId
      && [...toursStore.tours, ...toursStore.friendTours].some(tour => tour.id === entry.tourId)
    if (entry.tourId && visible && entry.action !== 'deleted')
      open.tour(entry.tourId)
    else
      snackbar.show(t('inbox.unavailable'))
  }

  // Push/email deep link: mark read, open the subject, strip the param so a reload or
  // back-navigation doesn't re-open it.
  watch(
    () => route.query.notification,
    async (id) => {
      if (typeof id !== 'string')
        return
      const { notification: _drop, ...rest } = route.query
      await router.replace({ query: rest })
      const entry = await inboxStore.find(id)
      if (!entry) {
        snackbar.show(t('inbox.unavailable'))
        return
      }
      inboxStore.markRead(entry.id)
      openEntry(entry)
    },
    { immediate: true },
  )

  return { openEntry, snackbar }
}
