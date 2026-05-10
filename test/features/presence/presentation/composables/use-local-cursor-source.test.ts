import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useLocalCursorSource } from '@/features/presence/presentation/composables/use-local-cursor-source'

const setLocalCursor = vi.fn()
const setLocalIdentity = vi.fn()

vi.mock('@/features/presence/presentation/stores/presence-store', () => ({
  usePresenceStore: () => ({
    setLocalCursor,
    setLocalIdentity,
  }),
}))

vi.mock('@/features/auth/presentation/stores/auth-store', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'ada@example.com' },
  }),
}))

vi.mock('@/features/user/presentation/stores/user-profile-store', () => ({
  useUserProfileStore: () => ({
    fullProfile: ref({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phoneNumber: null,
      phoneVerified: true,
    }),
  }),
}))

describe('useLocalCursorSource', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('ignores non-mouse pointer events', async () => {
    const unproject = vi.fn(() => ({ lng: 8, lat: 46 }))
    const canvas = document.createElement('canvas')
    const map = {
      getCanvas: () => canvas,
      unproject,
    }
    const Wrapper = defineComponent({
      setup() {
        useLocalCursorSource(() => map as never)
        return () => null
      },
    })
    mount(Wrapper)
    setLocalCursor.mockClear()
    canvas.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', offsetX: 1, offsetY: 2 }))
    await Promise.resolve()
    expect(unproject).not.toHaveBeenCalled()
    expect(setLocalCursor).not.toHaveBeenCalled()
  })

  it('clears cursor on pointerleave', async () => {
    const canvas = document.createElement('canvas')
    const map = {
      getCanvas: () => canvas,
      unproject: vi.fn(() => ({ lng: 1, lat: 2 })),
    }
    const Wrapper = defineComponent({
      setup() {
        useLocalCursorSource(() => map as never)
        return () => null
      },
    })
    mount(Wrapper)
    canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    await Promise.resolve()
    expect(setLocalCursor).toHaveBeenCalledWith(null)
  })
})
