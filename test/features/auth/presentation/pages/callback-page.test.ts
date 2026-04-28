import type { User } from '@supabase/supabase-js'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CallbackPage from '@/features/auth/presentation/pages/callback-page.vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

const mockRouteQuery: Record<string, string> = {}

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
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
    Object.keys(mockRouteQuery).forEach(k => delete mockRouteQuery[k])
  })

  it('should show loading state while auth store still loading', () => {
    const wrapper = mount(CallbackPage)
    expect(wrapper.find('.spinner').exists()).toBe(true)
    expect(wrapper.text()).toContain('auth.callback.loading')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('should redirect to map once authenticated', async () => {
    const authStore = useAuthStore()
    mount(CallbackPage)
    authStore.currentUser = { id: 'u1' } as User
    authStore.isLoading = false
    await nextTick()
    expect(mockReplace).toHaveBeenCalledWith({ name: 'map' })
  })

  it('should not redirect when load finished but unauthenticated', async () => {
    const authStore = useAuthStore()
    mount(CallbackPage)
    authStore.isLoading = false
    await nextTick()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('should show error when error_description query param present', () => {
    mockRouteQuery.error_description = 'token expired'
    const wrapper = mount(CallbackPage)
    expect(wrapper.find('.spinner').exists()).toBe(false)
    expect(wrapper.text()).toContain('auth.callback.errorTitle')
    expect(wrapper.text()).toContain('auth.callback.backToEmailBtn')
  })

  it('should not redirect in error state even if authenticated', async () => {
    mockRouteQuery.error_description = 'token expired'
    const authStore = useAuthStore()
    mount(CallbackPage)
    authStore.currentUser = { id: 'u1' } as User
    authStore.isLoading = false
    await nextTick()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('should navigate to email-entry on back button click in error state', async () => {
    mockRouteQuery.error_description = 'token expired'
    const wrapper = mount(CallbackPage)
    await wrapper.find('.back-btn-primary').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'email-entry' })
  })
})
