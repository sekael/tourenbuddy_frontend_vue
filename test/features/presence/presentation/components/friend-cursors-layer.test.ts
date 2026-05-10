import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendCursorsLayer from '@/features/presence/presentation/components/friend-cursors-layer.vue'

vi.mock('@/features/presence/presentation/composables/use-local-cursor-source', () => ({
  useLocalCursorSource: vi.fn(),
}))

vi.mock('@/features/presence/presentation/stores/presence-store', async () => {
  const { ref } = await import('vue')
  const friendCursors = ref(new Map())
  return {
    usePresenceStore: () => ({
      attachMapSession: vi.fn(),
      detachMapSession: vi.fn(),
      friendCursors,
    }),
  }
})

describe('friendCursorsLayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('adds geojson source and layers when style is loaded', async () => {
    const layers = new Set<string>()
    const sources = new Set<string>()
    const addSource = vi.fn((id: string) => {
      sources.add(id)
    })
    const addLayer = vi.fn((spec: { id: string }) => {
      layers.add(spec.id)
    })
    const removeLayer = vi.fn((id: string) => {
      layers.delete(id)
    })
    const removeSource = vi.fn((id: string) => {
      sources.delete(id)
    })
    const getSource = vi.fn((id: string) =>
      sources.has(id) ? { type: 'geojson', setData: vi.fn() } : undefined,
    )
    const getLayer = vi.fn((id: string) => (layers.has(id) ? {} : undefined))
    const map = {
      isStyleLoaded: () => true,
      getSource,
      getLayer,
      addSource,
      addLayer,
      removeLayer,
      removeSource,
      on: vi.fn(),
      off: vi.fn(),
    }

    const wrapper = mount(FriendCursorsLayer, {
      props: { map: map as never },
    })
    await wrapper.vm.$nextTick()
    expect(addSource).toHaveBeenCalledWith(
      'presence-cursors',
      expect.objectContaining({ type: 'geojson' }),
    )
    expect(addLayer).toHaveBeenCalled()
    wrapper.unmount()
    expect(removeLayer).toHaveBeenCalled()
    expect(removeSource).toHaveBeenCalled()
  })
})
