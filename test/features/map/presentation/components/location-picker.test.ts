import type { LocationResult } from '@/features/map/data/services/swisstopo-search-service'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOnline } from '@/core/offline/use-online-status'
import { searchLocations } from '@/features/map/data/services/swisstopo-search-service'
import LocationPicker from '@/features/map/presentation/components/location-picker.vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'

vi.mock('@/features/map/data/services/swisstopo-search-service', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/map/data/services/swisstopo-search-service')>(),
  searchLocations: vi.fn(),
}))
const search = vi.mocked(searchLocations)

function makeMapStub(overrides: Record<string, unknown> = {}) {
  const handlers = new Map<string, () => void>()
  return {
    getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
    getCanvas: vi.fn(() => ({ clientWidth: 800, clientHeight: 600 })),
    unproject: vi.fn(([x, y]: [number, number]) => ({ lng: x, lat: y })),
    getZoom: vi.fn(() => 8),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    on: vi.fn((event: string, fn: () => void) => handlers.set(event, fn)),
    off: vi.fn(),
    fire: (event: string) => handlers.get(event)?.(),
    ...overrides,
  }
}

const bernina: LocationResult = { name: 'Piz Bernina', kind: 'Alpiner Gipfel', region: 'Pontresina (GR)', origin: 'gazetteer', lng: 9.908, lat: 46.382, zoom: 14 }
const ela: LocationResult = { ...bernina, name: 'Piz Ela', lng: 9.66, lat: 46.6 }

function mountPicker(map = makeMapStub()) {
  const wrapper = mount(LocationPicker, {
    props: { map: map as never },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] },
  })
  return { wrapper, map }
}

async function type(wrapper: ReturnType<typeof mountPicker>['wrapper'], text: string) {
  await wrapper.find('.search-input').setValue(text)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('locationPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    search.mockReset()
    isOnline.value = true
  })
  afterEach(() => vi.useRealTimers())

  it('should emit confirm with pixel-center unproject coordinates, not getCenter', async () => {
    const { wrapper, map } = mountPicker()

    await wrapper.find('[data-testid="picker-confirm"]').trigger('click')

    // Must use unproject, not getCenter
    expect(map.unproject).toHaveBeenCalledWith([400, 300])
    expect(map.getCenter).not.toHaveBeenCalled()

    const emitted = wrapper.emitted('confirm') as [{ lng: number, lat: number }][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]).toEqual({ lng: 400, lat: 300 })
  })

  it('should return coordinates at canvas center regardless of map padding state', async () => {
    // Simulate a map with active padding from a prior flyTo — getCenter would
    // return a shifted value, but unproject on pixel center is always accurate.
    const { wrapper, map } = mountPicker(makeMapStub({
      getCenter: vi.fn(() => ({ lng: 8.9, lat: 47.1 })), // shifted by padding
      unproject: vi.fn(() => ({ lng: 8.2, lat: 46.8 })), // true crosshair pos
    }))

    await wrapper.find('[data-testid="picker-confirm"]').trigger('click')

    const emitted = wrapper.emitted('confirm') as [{ lng: number, lat: number }][]
    expect(emitted[0]![0]).toEqual({ lng: 8.2, lat: 46.8 })
    expect(map.getCenter).not.toHaveBeenCalled()
  })

  describe('search', () => {
    it('should not send a request for fewer than 2 characters', async () => {
      const { wrapper } = mountPicker()
      await type(wrapper, ' P ')
      expect(search).not.toHaveBeenCalled()
      expect(wrapper.find('.search-results').exists()).toBe(false)
    })

    it('should never let a slow earlier response replace newer results', async () => {
      const slow = deferred<LocationResult[]>()
      search.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([ela])
      const { wrapper } = mountPicker()

      await type(wrapper, 'Piz B')
      await type(wrapper, 'Piz Ela')
      slow.resolve([bernina])
      await flushPromises()

      expect(wrapper.findAll('.result-name').map(n => n.text())).toEqual(['Piz Ela'])
    })

    it('should abort the superseded request without showing an error', async () => {
      const second = deferred<LocationResult[]>()
      search.mockImplementationOnce((_q, _lang, signal) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })).mockReturnValueOnce(second.promise)
      const { wrapper } = mountPicker()

      await type(wrapper, 'Piz B')
      const firstSignal = search.mock.calls[0]![2]
      await type(wrapper, 'Piz Ela')

      // While the newer query is still in flight: the abort must not read as a failure.
      expect(firstSignal.aborted).toBe(true)
      expect(wrapper.find('.search-message').exists()).toBe(false)

      second.resolve([ela])
      await flushPromises()
      expect(wrapper.findAll('.result-name').map(n => n.text())).toEqual(['Piz Ela'])
    })

    it('should show an error message when the search fails or times out', async () => {
      search.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      const { wrapper } = mountPicker()
      await type(wrapper, 'Piz')
      expect(wrapper.find('.search-message').text()).toBe('tours.picker.search.error')
    })

    it('should abort a pending request when the picker closes', async () => {
      search.mockReturnValueOnce(deferred<LocationResult[]>().promise)
      const { wrapper } = mountPicker()
      await type(wrapper, 'Piz')
      wrapper.unmount()
      expect(search.mock.calls[0]![2].aborted).toBe(true)
    })

    it('should hide the field while offline', async () => {
      const { wrapper } = mountPicker()
      isOnline.value = false
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.search-input').exists()).toBe(false)
      expect(wrapper.find('[data-testid="picker-confirm"]').exists()).toBe(true)
    })
  })

  describe('choosing a result', () => {
    it('should move the crosshair onto the first result on Enter, with padding reset', async () => {
      search.mockResolvedValueOnce([bernina, ela])
      const { wrapper, map } = mountPicker()
      await type(wrapper, 'Piz')

      await wrapper.find('.search-input').trigger('keydown', { key: 'Enter' })

      expect(map.flyTo).toHaveBeenCalledWith({
        center: [bernina.lng, bernina.lat],
        zoom: 14,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      })
      expect(wrapper.find('.search-results').exists()).toBe(false)
    })

    it('should not search again for the chosen name written into the field', async () => {
      search.mockResolvedValueOnce([bernina])
      const { wrapper } = mountPicker()
      await type(wrapper, 'Piz B')
      await wrapper.find('.search-result').trigger('click')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('Piz Bernina')
      expect(search).toHaveBeenCalledTimes(1)
      expect(wrapper.find('.search-results').exists()).toBe(false)
    })

    it('should leave the draft goal marker alone', async () => {
      search.mockResolvedValueOnce([bernina])
      const { wrapper } = mountPicker()
      await type(wrapper, 'Piz')
      await wrapper.find('.search-result').trigger('click')
      expect(useMapStore().setPreviewGoal).not.toHaveBeenCalled()
    })

    it('should close the list without moving when the map is touched', async () => {
      search.mockResolvedValueOnce([bernina])
      const { wrapper, map } = mountPicker()
      await type(wrapper, 'Piz')

      map.fire('touchstart')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.search-results').exists()).toBe(false)
      expect(map.flyTo).not.toHaveBeenCalled()
    })

    it('should close the list on Escape and keep the picker open', async () => {
      search.mockResolvedValueOnce([bernina])
      const { wrapper } = mountPicker()
      await type(wrapper, 'Piz')

      await wrapper.find('.search-input').trigger('keydown', { key: 'Escape' })

      expect(wrapper.find('.search-results').exists()).toBe(false)
      expect(wrapper.emitted('cancel')).toBeUndefined()
    })
  })

  describe('confirm after a search', () => {
    const atResult = () => ({ lng: bernina.lng, lat: bernina.lat })

    async function chooseBernina(unproject: () => { lng: number, lat: number }) {
      search.mockResolvedValueOnce([bernina])
      const { wrapper } = mountPicker(makeMapStub({ unproject: vi.fn(unproject) }))
      await type(wrapper, 'Piz')
      await wrapper.find('.search-result').trigger('click')
      return wrapper
    }

    it('should pass the result name when the crosshair is still on it', async () => {
      const wrapper = await chooseBernina(atResult)
      await wrapper.find('[data-testid="picker-confirm"]').trigger('click')
      expect(wrapper.emitted('confirm')![0]![0]).toEqual({ ...atResult(), name: 'Piz Bernina' })
    })

    it('should omit the name after panning more than 50 m away', async () => {
      // 0.001° lat ≈ 111 m
      const wrapper = await chooseBernina(() => ({ lng: bernina.lng, lat: bernina.lat + 0.001 }))
      await wrapper.find('[data-testid="picker-confirm"]').trigger('click')
      expect(wrapper.emitted('confirm')![0]![0]).not.toHaveProperty('name')
    })

    it('should forget the chosen result once the field is cleared', async () => {
      const wrapper = await chooseBernina(atResult)
      await wrapper.find('.search-input').setValue('')
      await wrapper.find('[data-testid="picker-confirm"]').trigger('click')
      expect(wrapper.emitted('confirm')![0]![0]).not.toHaveProperty('name')
    })
  })

  describe('dock', () => {
    // happy-dom has no visualViewport; innerHeight is 768.
    function stubViewport(init: { height: number, offsetTop?: number, scale?: number }) {
      const vv = Object.assign(new EventTarget(), { offsetTop: 0, scale: 1, ...init })
      vi.stubGlobal('visualViewport', vv)
      return vv
    }
    afterEach(() => vi.unstubAllGlobals())

    it('should ride on the on-screen keyboard without the actions, and bring them back once it closes', async () => {
      const vv = stubViewport({ height: 468 })
      const { wrapper } = mountPicker()
      const dock = wrapper.find('.dock')
      expect(dock.classes()).toContain('dock--keyboard')
      expect(dock.attributes('style')).toContain('--keyboard-inset: 300px')
      expect(wrapper.find('.actions').attributes('style')).toContain('display: none')

      vv.height = 768
      vv.dispatchEvent(new Event('resize'))
      await flushPromises()
      expect(dock.classes()).not.toContain('dock--keyboard')
      expect(wrapper.find('.actions').attributes('style') ?? '').not.toContain('display: none')
    })

    it('should not mistake browser-chrome jitter or a pinch zoom for a keyboard', () => {
      stubViewport({ height: 740 })
      expect(mountPicker().wrapper.find('.dock').classes()).not.toContain('dock--keyboard')
      stubViewport({ height: 384, scale: 2 })
      expect(mountPicker().wrapper.find('.dock').classes()).not.toContain('dock--keyboard')
    })

    it('should clear the field and keep it focused for the next query', async () => {
      const wrapper = mount(LocationPicker, {
        props: { map: makeMapStub() as never },
        global: { plugins: [createTestingPinia({ createSpy: vi.fn })] },
        attachTo: document.body,
      })
      const clear = () => wrapper.find('button[aria-label="tours.picker.search.clear"]')
      expect(clear().exists()).toBe(false)

      await type(wrapper, 'Piz')
      await clear().trigger('click')
      const input = wrapper.find('.search-input').element as HTMLInputElement
      expect(input.value).toBe('')
      expect(document.activeElement).toBe(input)
      expect(clear().exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
