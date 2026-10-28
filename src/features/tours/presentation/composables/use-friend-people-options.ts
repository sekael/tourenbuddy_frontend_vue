import type { Ref } from 'vue'
import type { TourFilters } from './use-tour-filters'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
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
 * The Friends tab's people chips (#362), named the way rows and details name them: recorded-by =
 * the friends owning the tab's tours, by the viewer's contact for them; partners = the registered
 * partners named on those tours, contact name else profile name, the viewer as "Me" (first).
 * Anything selected stays offered, so a filter set from a contact detail can be cleared. A getter:
 * the panel outlives a tab switch, and each tab has its own filters.
 *
 * `settled` gates the chips so their labels render once, final: one batched phone lookup plus the
 * contacts load, failure counting as settled. Settled ids are remembered for the session, so
 * reopening the panel paints the chips at once instead of waiting on a lookup that cannot change
 * them (a co-partner who is no friend never gets a phone).
 * ponytail: gates the first paint only — a friend tour arriving while the panel is open, or a
 * second account signing in on the same tab, names its new chips progressively. Re-gate on id
 * changes only if that is ever seen to flicker.
 */
export function useFriendPeopleOptions(filters: () => TourFilters): {
  owners: Ref<FilterOption[]>
  partners: Ref<FilterOption[]>
  settled: Ref<boolean>
} {
  const { t } = useI18n({ useScope: 'global' })
  const toursStore = useToursStore()
  const contactsStore = useContactsStore()
  const friendshipsStore = useFriendshipsStore()
  const authStore = useAuthStore()

  const contactName = (userId: string) => resolveFriendName(
    userId,
    friendshipsStore.userIdToPhoneMap,
    phone => contactsStore.findContactByMethodValue('phone', phone),
  )
  const byLabel = (a: FilterOption, b: FilterOption) => a.label.localeCompare(b.label)

  const owners = computed(() =>
    [...new Set([...toursStore.friendTours.map(tour => tour.userId), ...filters().ownerIds])]
      .map(id => ({ id, label: contactName(id) ?? t('tours.list.aFriend') }))
      .sort(byLabel),
  )

  const partners = computed(() => {
    const me = authStore.currentUser?.id
    const profileNames = new Map([...filters().partnerIds].map(id => [id, '']))
    for (const tour of toursStore.friendTours) {
      for (const p of tour.partnerNames ?? [])
        profileNames.set(p.userId, [p.firstName, p.lastName].filter(Boolean).join(' '))
    }
    const options = [...profileNames].map(([id, profile]) => ({
      id,
      label: id === me ? t('tours.infoSheet.partnerSelf') : contactName(id) ?? (profile || t('tours.list.aFriend')),
    }))
    return options.sort((a, b) => Number(b.id === me) - Number(a.id === me) || byLabel(a, b))
  })

  const ids = [...owners.value, ...partners.value].map(o => o.id)
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

  return { owners, partners, settled: computed(() => phonesSettled.value && contactsStore.hasLoaded) }
}
