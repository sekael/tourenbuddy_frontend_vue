import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, ref, toValue, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

/**
 * The name to show for a friend, with a settle-then-render gate.
 *
 * `displayName` is written to the screen exactly once, in its final form: render it only
 * while `isResolved`, and hold a skeleton until then. Rendering the fallback first and
 * swapping it for the contact name once the lookups land is precisely the flip this exists
 * to prevent.
 *
 * `isResolved` means "no better answer is coming" — NOT "an answer arrived". A rejected
 * lookup settles too, otherwise an offline cold start shimmers forever.
 */
export function useFriendDisplayName(userId: MaybeRefOrGetter<string | null>): {
  displayName: Ref<string | null>
  isResolved: Ref<boolean>
} {
  const { t } = useI18n({ useScope: 'global' })
  const contactsStore = useContactsStore()
  const friendshipsStore = useFriendshipsStore()

  /** Whether the phone lookup for the CURRENT id has settled (resolved or failed). */
  const phoneSettled = ref(false)

  const displayName = computed<string | null>(() => {
    const id = toValue(userId)
    if (!id)
      return null
    const name = resolveFriendName(
      id,
      friendshipsStore.userIdToPhoneMap,
      phone => contactsStore.findContactByMethodValue('phone', phone),
    )
    // The fallback is not a naming strategy — it is the render of a broken
    // friendship↔contact link (#273), so the owner line always has content.
    return name ?? t('tours.list.aFriend')
  })

  // Both inputs must be final. `hasLoaded` rather than `!isLoading`: isLoading reads
  // false BEFORE the first load starts, so gating on it settles on the first tick with an
  // empty contact list and then flips. `contacts.length === 0` can't substitute either —
  // an empty address book is a legitimate settled state.
  const isResolved = computed(
    () => toValue(userId) === null || (phoneSettled.value && contactsStore.hasLoaded),
  )

  watch(
    () => toValue(userId),
    (id) => {
      // Back to unresolved on every id change: a component reused for another tour must
      // not show the previous owner's name through the gap.
      phoneSettled.value = false
      if (!id)
        return
      // Not every host page loads contacts (the gate would never settle there).
      if (!contactsStore.hasLoaded && !contactsStore.isLoading)
        void contactsStore.loadContacts()
      // Wrapped: the gate must settle even if the action is a stub that returns nothing.
      Promise.resolve(friendshipsStore.ensurePhones([id]))
        .catch(() => {})
        .then(() => {
          // Ignore a stale lookup that lands after the id moved on.
          if (toValue(userId) === id)
            phoneSettled.value = true
        })
    },
    { immediate: true },
  )

  return { displayName, isResolved }
}
