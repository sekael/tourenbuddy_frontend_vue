import type { Contact } from '@/features/contacts/domain/entities/contact'
import { storeToRefs } from 'pinia'
import { computed, toValue } from 'vue'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { useUserBlocksStore } from '@/features/friendships/presentation/stores/user-blocks-store'

/** Whether the caller blocks this contact: its linked friend, or any of its phones. */
export function useContactBlocked(contact: () => Contact, linkedFriendUserId: () => string | null | undefined) {
  const { blockedPhones, blockedUserIds } = storeToRefs(useUserBlocksStore())
  return computed(() => {
    const userId = toValue(linkedFriendUserId)
    if (userId && blockedUserIds.value.has(userId))
      return true
    return toValue(contact).contactMethods.some((m) => {
      if (m.methodType !== 'phone')
        return false
      const norm = normalizePhone(m.value)
      return blockedPhones.value.has(norm.ok ? norm.e164 : m.value)
    })
  })
}
