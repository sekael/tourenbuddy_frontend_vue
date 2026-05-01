import type { Ref } from 'vue'
import type { Contact } from '@/features/contacts/domain/entities/contact'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'

/**
 * Maintains a phone→userId map for all contact phones and derives which contacts
 * are platform friends. Reacts to both new contacts and friendship changes.
 */
export function useContactFriendshipMap(contacts: Ref<Contact[]>) {
  const friendshipsStore = useFriendshipsStore()
  const { friendUserIds, isPhoneVerified } = storeToRefs(friendshipsStore)

  const phoneToUserIdMap = ref(new Map<string, string>())

  async function refreshUnknownPhones(contactList: Contact[]) {
    if (!isPhoneVerified.value || contactList.length === 0)
      return
    const unknown = new Set<string>()
    for (const contact of contactList) {
      for (const method of contact.contactMethods.filter(m => m.methodType === 'phone')) {
        const norm = normalizePhone(method.value)
        if (norm.ok && !phoneToUserIdMap.value.has(norm.e164))
          unknown.add(norm.e164)
      }
    }
    if (unknown.size === 0)
      return
    const matches = await friendshipsStore.findUsersByPhones([...unknown])
    if (matches.length === 0)
      return
    const updated = new Map(phoneToUserIdMap.value)
    for (const m of matches) updated.set(m.phone, m.userId)
    phoneToUserIdMap.value = updated
  }

  watch(contacts, newContacts => refreshUnknownPhones(newContacts), { immediate: true })
  watch(isPhoneVerified, (verified) => {
    if (verified)
      refreshUnknownPhones(contacts.value)
  })

  const contactFriendIds = computed<Set<string>>(() => {
    const result = new Set<string>()
    for (const contact of contacts.value) {
      for (const method of contact.contactMethods.filter(m => m.methodType === 'phone')) {
        const norm = normalizePhone(method.value)
        const phone = norm.ok ? norm.e164 : method.value
        const uid = phoneToUserIdMap.value.get(phone)
        if (uid && friendUserIds.value.has(uid)) {
          result.add(contact.id)
          break
        }
      }
    }
    return result
  })

  return { contactFriendIds, phoneToUserIdMap }
}
