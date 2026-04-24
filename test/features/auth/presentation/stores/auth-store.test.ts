import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('@/features/i18n/presentation/stores/use-locale-store', () => ({
  useLocaleStore: vi.fn(() => ({ locale: 'en' })),
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should start with no user and loading state', () => {
    const store = useAuthStore()
    expect(store.currentUser).toBeNull()
    expect(store.isLoading).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })

  it('should set isLoading to false after initialize with no session', async () => {
    const { supabase } = await import('@/core/utils/supabase')
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never)

    const store = useAuthStore()
    await store.initialize()

    expect(store.isLoading).toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })

  it('should call sendMagicLink with correct signInWithOtp shape for en locale', async () => {
    const { supabase } = await import('@/core/utils/supabase')
    const { useLocaleStore } = await import('@/features/i18n/presentation/stores/use-locale-store')
    vi.mocked(useLocaleStore).mockReturnValue({ locale: 'en' } as never)

    const store = useAuthStore()
    await store.sendMagicLink('test@example.com')

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?locale=en`,
        data: { locale: 'en' },
      },
    })
  })

  it('should call sendMagicLink with de locale for de-CH active locale', async () => {
    const { supabase } = await import('@/core/utils/supabase')
    const { useLocaleStore } = await import('@/features/i18n/presentation/stores/use-locale-store')
    vi.mocked(useLocaleStore).mockReturnValue({ locale: 'de-CH' } as never)

    const store = useAuthStore()
    await store.sendMagicLink('test@example.com')

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?locale=de`,
        data: { locale: 'de' },
      },
    })
  })

  it('should throw when sendMagicLink returns an error', async () => {
    const { supabase } = await import('@/core/utils/supabase')
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
      error: new Error('rate limited'),
    } as never)

    const store = useAuthStore()
    await expect(store.sendMagicLink('test@example.com')).rejects.toThrow('rate limited')
  })

  it('should clear user on sign out', async () => {
    const store = useAuthStore()
    await store.signOut()

    expect(store.currentUser).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('should not clear tb.locale from localStorage on sign out', async () => {
    localStorage.setItem('tb.locale', 'de-CH')
    const store = useAuthStore()
    await store.signOut()
    expect(localStorage.getItem('tb.locale')).toBe('de-CH')
    localStorage.removeItem('tb.locale')
  })
})
