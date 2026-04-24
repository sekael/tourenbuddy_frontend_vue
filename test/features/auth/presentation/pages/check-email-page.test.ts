import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckEmailPage from '@/features/auth/presentation/pages/check-email-page.vue'

const mockSendMagicLink = vi.fn()

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({ sendMagicLink: mockSendMagicLink })),
}))

const mockBack = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useRoute: () => ({ query: { email: 'test@example.com' } }),
}))

describe('checkEmailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should render email in subtitle', () => {
    const wrapper = mount(CheckEmailPage)
    expect(wrapper.text()).toContain('test@example.com')
  })

  it('should show resend button', () => {
    const wrapper = mount(CheckEmailPage)
    expect(wrapper.find('.resend-btn').exists()).toBe(true)
  })

  it('should call sendMagicLink with email on resend click', async () => {
    mockSendMagicLink.mockResolvedValue(undefined)
    const wrapper = mount(CheckEmailPage)
    await wrapper.find('.resend-btn').trigger('click')
    await vi.waitFor(() => expect(mockSendMagicLink).toHaveBeenCalledWith('test@example.com'))
  })

  it('should show success message after successful resend', async () => {
    mockSendMagicLink.mockResolvedValue(undefined)
    const wrapper = mount(CheckEmailPage)
    await wrapper.find('.resend-btn').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('auth.checkEmail.resendSuccess'))
  })

  it('should show error message when resend fails', async () => {
    mockSendMagicLink.mockRejectedValue(new Error('network error'))
    const wrapper = mount(CheckEmailPage)
    await wrapper.find('.resend-btn').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('auth.checkEmail.resendError'))
  })

  it('should call router.back on back button click', async () => {
    const wrapper = mount(CheckEmailPage)
    await wrapper.find('.back-btn').trigger('click')
    expect(mockBack).toHaveBeenCalled()
  })
})
