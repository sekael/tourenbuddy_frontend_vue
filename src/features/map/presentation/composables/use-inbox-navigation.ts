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

  async function openEntry(entry: InboxNotification) {
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
    const tourId = inboxStore.targetTourId(entry)
    if (!tourId || entry.action === 'deleted') {
      snackbar.show(t('inbox.unavailable'))
      return
    }
    // Decide on the server's answer, not the store: the list may be an offline-cache
    // paint from before the recipient lost access. Online this awaits the fresh fetch;
    // offline the cache is all there is.
    await toursStore.loadFriendTours()
    if (inboxStore.canOpenTour(tourId))
      open.tour(tourId)
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
      await openEntry(entry)
    },
    { immediate: true },
  )

  return { openEntry, snackbar }
}
