import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocaleStore } from '@/features/i18n/presentation/stores/use-locale-store'

const { mockUpdateUser, mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  mockUpdateUser: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/core/utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
    },
  },
}))

vi.mock('@/core/i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
      t: vi.fn((key: string) => key),
    },
  },
}))

vi.mock('@/core/i18n/persistence', () => ({
  writePersistedLocale: vi.fn(),
}))

describe('useLocaleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockUpdateUser.mockResolvedValue({ error: null })
    Object.defineProperty(document.documentElement, 'lang', {
      set: vi.fn(),
      get: vi.fn(() => 'en'),
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes locale from i18n.global.locale', async () => {
    const { i18n } = await import('@/core/i18n')
    ;(i18n.global.locale as { value: string }).value = 'en'
    const store = useLocaleStore()
    expect(store.locale).toBe('en')
  })

  it('setLocale updates locale ref for supported code', () => {
    const store = useLocaleStore()
    store.setLocale('de-CH')
    expect(store.locale).toBe('de-CH')
  })

  it('setLocale does not update for unsupported code', () => {
    const store = useLocaleStore()
    const initial = store.locale
    store.setLocale('xx-YY')
    expect(store.locale).toBe(initial)
  })

  it('setLocale writes to localStorage', async () => {
    const { writePersistedLocale } = await import('@/core/i18n/persistence')
    const store = useLocaleStore()
    store.setLocale('de-CH')
    expect(writePersistedLocale).toHaveBeenCalledWith('de-CH')
  })

  it('setLocale updates i18n.global.locale.value', async () => {
    const { i18n } = await import('@/core/i18n')
    const store = useLocaleStore()
    store.setLocale('de-CH')
    expect((i18n.global.locale as { value: string }).value).toBe('de-CH')
  })

  it('setLocale calls updateUser with de when authenticated and locale is de-CH', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const store = useLocaleStore()
    store.setLocale('de-CH')
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ data: { locale: 'de' } }))
  })

  it('setLocale calls updateUser with en when authenticated and locale is en', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const store = useLocaleStore()
    store.setLocale('en')
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ data: { locale: 'en' } }))
  })

  it('setLocale does NOT call updateUser when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const store = useLocaleStore()
    store.setLocale('de-CH')
    await new Promise(r => setTimeout(r, 10))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
