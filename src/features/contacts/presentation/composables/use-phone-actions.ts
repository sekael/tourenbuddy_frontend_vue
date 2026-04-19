import type { MaybeRef } from 'vue'
import { computed, toValue } from 'vue'

const E164_REGEX = /^\+[1-9]\d{1,14}$/

/**
 * Returns reactive tel: and wa.me links for a phone number.
 * Both null when no phone is given.
 * When the input is E.164 (^\+[1-9]\d{1,14}$), both links are produced.
 * Legacy non-E.164 inputs (isValid=false rows) get only a tel: link; whatsAppLink is null.
 */
export function usePhoneActions(phoneNumber: MaybeRef<string | null>) {
  const telLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone)
      return null
    const trimmed = phone.trim()
    const hasPlus = trimmed.startsWith('+')
    const digits = trimmed.replace(/\D/g, '')
    return `tel:${hasPlus ? `+${digits}` : digits}`
  })

  const whatsAppLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone)
      return null
    const trimmed = phone.trim()
    if (E164_REGEX.test(trimmed)) {
      const digits = trimmed.slice(1)
      return `https://wa.me/${digits}`
    }
    return null
  })

  return { telLink, whatsAppLink }
}
