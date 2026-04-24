import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallbackPage from '@/features/auth/presentation/pages/callback-page.vue'

let authStateChangeCallback: ((event: string) => void) | null = null

const mockRouteQuery: Record<string, string> = {}

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string) => void) => {
        authStateChangeCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  },
}))

const mockReplace = vi.fn()
const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useRoute: () => ({ query: mockRouteQuery }),
}))

describe('callbackPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    authStateChangeCallback = null
    Object.keys(mockRouteQuery).forEach(k => delete mockRouteQuery[k])
  })

  it('should show loading state by default', () => {
    const wrapper = mount(CallbackPage)
    expect(wrapper.find('.spinner').exists()).toBe(true)
    expect(wrapper.text()).toContain('auth.callback.loading')
  })

  it('should redirect to map on SIGNED_IN event', async () => {
    mount(CallbackPage)
    authStateChangeCallback?.('SIGNED_IN')
    await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ name: 'map' }))
  })

  it('should show error when error_description query param present', () => {
    mockRouteQuery.error_description = 'token expired'
    const wrapper = mount(CallbackPage)
    expect(wrapper.find('.spinner').exists()).toBe(false)
    expect(wrapper.text()).toContain('auth.callback.errorTitle')
    expect(wrapper.text()).toContain('auth.callback.backToEmailBtn')
  })

  it('should navigate to email-entry on back button click in error state', async () => {
    mockRouteQuery.error_description = 'token expired'
    const wrapper = mount(CallbackPage)
    await wrapper.find('.back-btn-primary').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'email-entry' })
  })
})
