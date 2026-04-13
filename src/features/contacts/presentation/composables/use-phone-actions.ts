import type { MaybeRef } from 'vue'
import { computed, toValue } from 'vue'

function stripToDialable(phone: string): string {
  // Keep leading + and all digits
  const hasPlus = phone.trimStart().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

/** Returns reactive tel: and wa.me links for a phone number. Both null when no phone. */
export function usePhoneActions(phoneNumber: MaybeRef<string | null>) {
  const telLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone) return null
    return `tel:${stripToDialable(phone)}`
  })

  const whatsAppLink = computed(() => {
    const phone = toValue(phoneNumber)
    if (!phone) return null
    // wa.me requires digits only, no +
    const digits = phone.replace(/\D/g, '')
    return `https://wa.me/${digits}`
  })

  return { telLink, whatsAppLink }
}
