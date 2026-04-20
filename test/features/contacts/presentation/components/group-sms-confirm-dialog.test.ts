import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import GroupSmsConfirmDialog from '@/features/contacts/presentation/components/group-sms-confirm-dialog.vue'

function makeContact(id: string, phone: string | null, isValid = true) {
  return {
    id,
    userId: 'u1',
    firstName: `Contact ${id}`,
    lastName: null,
    displayName: null,
    contactMethods: phone
      ? [
          {
            id: `m-${id}`,
            contactId: id,
            methodType: 'phone' as const,
            value: phone,
            label: null,
            isPrimary: true,
            isValid,
          },
        ]
      : [],
  }
}

function mountDialog(partners: ReturnType<typeof makeContact>[]) {
  return mount(GroupSmsConfirmDialog, {
    props: { partners },
  })
}

describe('groupSmsConfirmDialog', () => {
  it('enables Send when all partners have valid phones', () => {
    const partners = [makeContact('c1', '+41791111111'), makeContact('c2', '+41792222222')]
    const wrapper = mountDialog(partners)
    expect(wrapper.find('[data-testid="send-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Send when no partners have valid phones', () => {
    const partners = [makeContact('c1', null)]
    const wrapper = mountDialog(partners)
    expect(wrapper.find('[data-testid="send-btn"]').attributes('disabled')).toBeDefined()
  })

  it('shows excluded contacts separately', () => {
    const partners = [makeContact('c1', '+41791111111'), makeContact('c2', null)]
    const wrapper = mountDialog(partners)
    expect(wrapper.find('.excluded-label').exists()).toBe(true)
  })

  it('emits confirm with included E.164 numbers on send', async () => {
    const partners = [makeContact('c1', '+41791111111'), makeContact('c2', '+41792222222')]
    const wrapper = mountDialog(partners)

    const locationSpy = vi.spyOn(window, 'location', 'get')
    const mockLocation = { href: '' }
    locationSpy.mockReturnValue(mockLocation as unknown as Location)

    await wrapper.find('[data-testid="send-btn"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    const [recipients] = wrapper.emitted('confirm')![0] as [string[]]
    expect(recipients).toContain('+41791111111')
    expect(recipients).toContain('+41792222222')
  })

  it('composes correct sms: URI for two recipients', async () => {
    const partners = [makeContact('c1', '+41791111111'), makeContact('c2', '+41792222222')]
    const wrapper = mountDialog(partners)

    let capturedHref = ''
    const locationSpy = vi.spyOn(window, 'location', 'get')
    locationSpy.mockReturnValue({
      set href(v: string) {
        capturedHref = v
      },
      get href() {
        return capturedHref
      },
    } as unknown as Location)

    await wrapper.find('[data-testid="send-btn"]').trigger('click')
    expect(capturedHref).toBe('sms:+41791111111,+41792222222')
  })

  it('emits cancel when Cancel is clicked', async () => {
    const partners = [makeContact('c1', '+41791111111')]
    const wrapper = mountDialog(partners)
    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
