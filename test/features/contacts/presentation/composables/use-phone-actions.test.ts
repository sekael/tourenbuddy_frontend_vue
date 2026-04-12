import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePhoneActions } from '@/features/contacts/presentation/composables/use-phone-actions'

describe('usePhoneActions', () => {
  it('should generate tel link stripping non-digits but preserving +', () => {
    const { telLink } = usePhoneActions('+41 79 123 45 67')
    expect(telLink.value).toBe('tel:+41791234567')
  })

  it('should generate tel link without + for local numbers', () => {
    const { telLink } = usePhoneActions('079 123 45 67')
    expect(telLink.value).toBe('tel:0791234567')
  })

  it('should generate WhatsApp link with digits only (no +)', () => {
    const { whatsAppLink } = usePhoneActions('+41 79 123 45 67')
    expect(whatsAppLink.value).toBe('https://wa.me/41791234567')
  })

  it('should return null links for null phone', () => {
    const { telLink, whatsAppLink } = usePhoneActions(null)
    expect(telLink.value).toBeNull()
    expect(whatsAppLink.value).toBeNull()
  })

  it('should be reactive to ref changes', () => {
    const phone = ref<string | null>('+41 79 111 22 33')
    const { telLink, whatsAppLink } = usePhoneActions(phone)

    expect(telLink.value).toBe('tel:+41791112233')
    expect(whatsAppLink.value).toBe('https://wa.me/41791112233')

    phone.value = null
    expect(telLink.value).toBeNull()
    expect(whatsAppLink.value).toBeNull()
  })
})
