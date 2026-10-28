import type { Ref } from 'vue'
import type { TourFilters } from './use-tour-filters'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

/** Ids whose phone lookup has settled this session (module-level: outlives the panel). */
const settledIds = new Set<string>()

export interface FilterOption {
  id: string
  label: string
}

/**
 * The Friends tab's recorded-by chips (#362): the friends owning the tab's tours, named by the
 * viewer's contact for them, ordered by label. A friend still selected stays offered, so a filter
 * set from a contact detail can be cleared. A getter: each tab has its own filters.
 *
 * `settled` gates the chips so their labels render once, final: one batched phone lookup plus the
 * contacts load, failure counting as settled. Settled ids are remembered for the session, so
 * reopening the panel paints the chips at once instead of waiting on a lookup that cannot change
 * them.
 * ponytail: gates the first paint only — a friend tour arriving while the panel is open names its
 * new chip progressively. Re-gate on id changes only if that is ever seen to flicker.
 */
export function useFriendOwnerOptions(filters: () => TourFilters): {
  owners: Ref<FilterOption[]>
  settled: Ref<boolean>
} {
  const { t } = useI18n({ useScope: 'global' })
  const toursStore = useToursStore()
  const contactsStore = useContactsStore()
  const friendshipsStore = useFriendshipsStore()

  const contactName = (userId: string) => resolveFriendName(
    userId,
    friendshipsStore.userIdToPhoneMap,
    phone => contactsStore.findContactByMethodValue('phone', phone),
  )

  const owners = computed(() =>
    [...new Set([...toursStore.friendTours.map(tour => tour.userId), ...filters().ownerIds])]
      .map(id => ({ id, label: contactName(id) ?? t('tours.list.aFriend') }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  )

  const ids = owners.value.map(o => o.id)
  const phonesSettled = ref(ids.every(id => settledIds.has(id)))
  if (!contactsStore.hasLoaded && !contactsStore.isLoading)
    void contactsStore.loadContacts()
  if (!phonesSettled.value) {
    Promise.resolve(friendshipsStore.ensurePhones(ids))
      .catch(() => {})
      .then(() => {
        ids.forEach(id => settledIds.add(id))
        phonesSettled.value = true
      })
  }

  return { owners, settled: computed(() => phonesSettled.value && contactsStore.hasLoaded) }
}
