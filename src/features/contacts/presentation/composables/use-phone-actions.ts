import type { MaybeRef } from 'vue'
import { computed, toValue } from 'vue'

function stripToDialable(phone: string): string {
  // Keep leading + and all digits
  const hasPlus = phone.trimStart().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * Returns reactive tel: and wa.me links for a phone number. Both null when no phone.
 * `whatsAppLink` is null unless the input is in international form (starts with `+` or `00`),
 * because wa.me requires full E.164 digits without a leading zero.
 */
export function usePhoneActions(phoneNumber: MaybeRef<string | null>) {
  const telLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone) return null
    return `tel:${stripToDialable(phone)}`
  })

  const whatsAppLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone) return null
    const trimmed = phone.trimStart()
    // wa.me requires full E.164 digits only — only emit when country code is unambiguous
    if (trimmed.startsWith('+')) {
      const digits = trimmed.slice(1).replace(/\D/g, '')
      return `https://wa.me/${digits}`
    }
    if (trimmed.startsWith('00')) {
      const digits = trimmed.slice(2).replace(/\D/g, '')
      return `https://wa.me/${digits}`
    }
    return null
  })

  return { telLink, whatsAppLink }
}
