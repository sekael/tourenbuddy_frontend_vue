import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import VerifyOtpPage from '@/features/auth/presentation/pages/verify-otp-page.vue'

const mockVerifyOtp = vi.fn()
const mockSendEmailOtp = vi.fn()
const mockPush = vi.fn()

const mockAuthStore = reactive({
  verifyOtp: mockVerifyOtp,
  sendEmailOtp: mockSendEmailOtp,
  isAuthenticated: false,
})

const mockProfileStore = reactive({ isLoading: false })

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

vi.mock('@/features/user/presentation/stores/user-profile-store', () => ({
  useUserProfileStore: vi.fn(() => mockProfileStore),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: { email: 'test@example.com' } }),
}))

describe('verifyOtpPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthStore.isAuthenticated = false
    mockAuthStore.verifyOtp = mockVerifyOtp
    mockAuthStore.sendEmailOtp = mockSendEmailOtp
    mockProfileStore.isLoading = false
  })

  it('should render email in subtitle', () => {
    const wrapper = mount(VerifyOtpPage)
    expect(wrapper.text()).toContain('test@example.com')
  })

  it('should call verifyOtp with email and code on submit', async () => {
    mockVerifyOtp.mockResolvedValue(undefined)
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('input').setValue('123456')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith('test@example.com', '123456'),
    )
  })

  it('should navigate to map when authenticated and profile finished loading', async () => {
    mount(VerifyOtpPage)
    mockAuthStore.isAuthenticated = true
    mockProfileStore.isLoading = false
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith({ name: 'map' }))
  })

  it('should not navigate while profile is still loading', async () => {
    mount(VerifyOtpPage)
    mockProfileStore.isLoading = true
    mockAuthStore.isAuthenticated = true
    await new Promise(r => setTimeout(r, 50))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should show error message and clear input when verifyOtp fails', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('invalid token'))
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('input').setValue('000000')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('invalid token')
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
    })
  })

  it('should call sendEmailOtp on resend click', async () => {
    mockSendEmailOtp.mockResolvedValue(undefined)
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('.base-button--text').trigger('click')
    await vi.waitFor(() => expect(mockSendEmailOtp).toHaveBeenCalledWith('test@example.com'))
  })

  it('should show success message after successful resend', async () => {
    mockSendEmailOtp.mockResolvedValue(undefined)
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('.base-button--text').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('auth.verifyOtp.resendSuccess'))
  })

  it('should show error message when resend fails', async () => {
    mockSendEmailOtp.mockRejectedValue(new Error('network error'))
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('.base-button--text').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('auth.verifyOtp.resendError'))
  })

  it('should navigate to email-entry on back button click', async () => {
    const wrapper = mount(VerifyOtpPage)
    await wrapper.find('.back-btn').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'email-entry' })
  })
})
