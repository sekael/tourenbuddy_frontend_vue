import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'

function makeMapStub(overrides: Record<string, unknown> = {}) {
  return {
    getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
    getCanvas: vi.fn(() => ({ clientWidth: 800, clientHeight: 600 })),
    unproject: vi.fn(([x, y]: [number, number]) => ({ lng: x, lat: y })),
    ...overrides,
  }
}

describe('locationPicker', () => {
  it('should emit confirm with pixel-center unproject coordinates, not getCenter', async () => {
    const map = makeMapStub()
    const wrapper = mount(LocationPicker, { props: { map: map as never } })

    await wrapper.find('.confirm-btn').trigger('click')

    // Must use unproject, not getCenter
    expect(map.unproject).toHaveBeenCalledWith([400, 300])
    expect(map.getCenter).not.toHaveBeenCalled()

    const emitted = wrapper.emitted('confirm') as [{ lng: number; lat: number }][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]).toEqual({ lng: 400, lat: 300 })
  })

  it('should return coordinates at canvas center regardless of map padding state', async () => {
    // Simulate a map with active padding from a prior flyTo — getCenter would
    // return a shifted value, but unproject on pixel center is always accurate.
    const map = makeMapStub({
      getCenter: vi.fn(() => ({ lng: 8.9, lat: 47.1 })), // shifted by padding
      unproject: vi.fn(() => ({ lng: 8.2, lat: 46.8 })), // true crosshair pos
    })
    const wrapper = mount(LocationPicker, { props: { map: map as never } })

    await wrapper.find('.confirm-btn').trigger('click')

    const emitted = wrapper.emitted('confirm') as [{ lng: number; lat: number }][]
    expect(emitted[0]![0]).toEqual({ lng: 8.2, lat: 46.8 })
    expect(map.getCenter).not.toHaveBeenCalled()
  })
})
