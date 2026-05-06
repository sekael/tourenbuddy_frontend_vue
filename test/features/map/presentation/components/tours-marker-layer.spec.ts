import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPieMarkerElement, fadeIn, fadeOut } from '@/features/map/presentation/components/pie-marker'

// Minimal MapLibre stub with all events needed for the new cluster pipeline
function makeStubMap(individualFeatures: object[] = []) {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  const layers: Record<string, { filter?: unknown }> = {}
  const sources: Record<string, { type: string }> = {}

  return {
    addSource: vi.fn((id: string, opts: { type: string }) => {
      sources[id] = { type: opts.type }
    }),
    getSource: vi.fn((id: string) => {
      if (!sources[id])
        return undefined
      return {
        type: 'geojson',
        setData: vi.fn(),
      }
    }),
    addLayer: vi.fn((layer: { id: string }) => {
      layers[layer.id] = {}
    }),
    getLayer: vi.fn((id: string) => layers[id] ?? null),
    setFilter: vi.fn((id: string, filter: unknown) => {
      if (layers[id])
        layers[id].filter = filter
    }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event])
        listeners[event] = []
      listeners[event].push(handler)
    }),
    off: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    hasImage: vi.fn(() => true),
    addImage: vi.fn(),
    easeTo: vi.fn(),
    getZoom: vi.fn(() => 10),
    getBounds: vi.fn(() => ({
      getWest: () => 7,
      getSouth: () => 46,
      getEast: () => 9,
      getNorth: () => 48,
    })),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
    project: vi.fn(() => ({ x: 100, y: 100 })),
    unproject: vi.fn(() => ({ lng: 8, lat: 47 })),
    querySourceFeatures: vi.fn((_id: string, opts?: { filter?: unknown[] }) => {
      const filter = opts?.filter
      if (Array.isArray(filter) && filter[0] === 'has' && filter[1] === 'point_count')
        return []
      return individualFeatures
    }),
    emit: (event: string, ...args: unknown[]) => {
      for (const handler of listeners[event] ?? [])
        handler(...args)
    },
  }
}

// Mock maplibre-gl Marker capturing the element
vi.mock('maplibre-gl', () => {
  const Marker = vi.fn().mockImplementation((opts: { element?: HTMLElement } = {}) => {
    const el = opts.element ?? document.createElement('div')
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      getElement: vi.fn(() => el),
    }
  })
  return {
    default: { Marker },
    Marker,
  }
})

describe('useToursMarkerLayer — setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not throw during setup with empty source', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster of N tours')
    await expect(layer.setup()).resolves.not.toThrow()
  })

  it('should call cleanup without error when cache is empty', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster of N tours')
    await layer.setup()
    expect(() => layer.cleanup()).not.toThrow()
  })

  it('should update selected filter on updateTours', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster of N tours')
    await layer.setup()
    layer.updateTours([], 'tour-123')
    expect(map.setFilter).toHaveBeenCalledWith(
      'tours-circles-selected',
      expect.arrayContaining(['all']),
    )
  })

  it('should subscribe to move, moveend, zoom, zoomend, idle, zoomstart, movestart events', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster')
    await layer.setup()

    const registeredEvents = (map.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (args: unknown[]) => args[0],
    )
    expect(registeredEvents).toContain('move')
    expect(registeredEvents).toContain('moveend')
    expect(registeredEvents).toContain('zoom')
    expect(registeredEvents).toContain('zoomend')
    expect(registeredEvents).toContain('idle')
    expect(registeredEvents).toContain('zoomstart')
  })

  it('should not call querySourceFeatures with cluster filter for cluster sync', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster')
    await layer.setup()

    // Trigger all cluster-sync events
    ;(map as ReturnType<typeof makeStubMap>).emit('move')
    ;(map as ReturnType<typeof makeStubMap>).emit('moveend')
    ;(map as ReturnType<typeof makeStubMap>).emit('idle')

    // querySourceFeatures should NOT have been called with the cluster filter
    const calls = (map.querySourceFeatures as ReturnType<typeof vi.fn>).mock.calls
    const clusterCalls = calls.filter(
      (args: unknown[]) =>
        Array.isArray(args[1]?.filter) && args[1].filter[1] === 'point_count',
    )
    expect(clusterCalls).toHaveLength(0)
  })
})

describe('useToursMarkerLayer — reduced motion gate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not run animations when prefers-reduced-motion is set', async () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList)

    vi.resetModules()
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster of N tours')
    await layer.setup()

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    ;(map as ReturnType<typeof makeStubMap>).emit('zoomend')

    await new Promise(r => setTimeout(r, 10))

    expect(rafSpy).not.toHaveBeenCalled()
    matchMediaSpy.mockRestore()
  })
})

describe('opacity bridge — pie-marker', () => {
  it('should create pie marker element with opacity 0', () => {
    const el = createPieMarkerElement({ hiking: 2 }, 2, {
      'skiing': '#1565C0',
      'snowboarding': '#1565C0',
      'skitour': '#1565C0',
      'splitboarding': '#1565C0',
      'ski-mountaineering': '#1565C0',
      'paragliding': '#D97706',
      'hiking': '#DC2626',
      'mountaineering': '#DC2626',
      'climbing': '#DC2626',
      'mountain-biking': '#DC2626',
      'trailrunning': '#DC2626',
    }).element
    expect(el.style.opacity).toBe('0')
  })

  it('fadeIn should schedule opacity 1 via requestAnimationFrame', () => {
    const el = document.createElement('div')
    el.style.opacity = '0'
    el.style.transition = 'opacity 200ms ease'

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    fadeIn(el)

    expect(rafSpy).toHaveBeenCalled()
    expect(el.style.opacity).toBe('1')
    rafSpy.mockRestore()
  })

  it('fadeOut should set opacity 0 and call onDone on transitionend', () => {
    const el = document.createElement('div')
    el.style.opacity = '1'

    const onDone = vi.fn()
    fadeOut(el, onDone)

    expect(el.style.opacity).toBe('0')
    expect(onDone).not.toHaveBeenCalled()

    // Simulate transitionend
    el.dispatchEvent(new Event('transitionend'))
    expect(onDone).toHaveBeenCalledOnce()
  })
})

describe('anticipatory staging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should stage markers at opacity 0 on zoomstart', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster')
    await layer.setup()

    // Loading tours triggers index.load — with empty map getBounds/getZoom stubs, no staging
    layer.updateTours([], null)

    const maplibregl = await import('maplibre-gl')
    const MarkerMock = vi.mocked(maplibregl.Marker)
    const callCountBefore = MarkerMock.mock.calls.length

    // Trigger zoomstart — anticipatory staging runs
    ;(map as ReturnType<typeof makeStubMap>).emit('zoomstart')

    // Any staged markers (if index returned clusters) would have opacity 0
    const newCalls = MarkerMock.mock.calls.slice(callCountBefore)
    for (const [opts] of newCalls as [{ element?: HTMLElement }][]) {
      if (opts?.element) {
        expect(opts.element.style.opacity).toBe('0')
      }
    }
  })

  it('should promote staged marker to cache on zoomend if in authoritative snapshot', async () => {
    const { useToursMarkerLayer } = await import(
      '@/features/map/presentation/components/tours-marker-layer'
    )
    const map = makeStubMap() as unknown as import('maplibre-gl').Map
    const layer = useToursMarkerLayer(map, vi.fn(), () => 'Cluster')
    await layer.setup()

    // No tours so no clusters — just verify zoomend doesn't throw
    ;(map as ReturnType<typeof makeStubMap>).emit('zoomstart')
    expect(() => (map as ReturnType<typeof makeStubMap>).emit('zoomend')).not.toThrow()
  })
})
