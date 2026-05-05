import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal MapLibre stubs
function makeStubMap(clusterFeatures: object[] = [], individualFeatures: object[] = []) {
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
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    easeTo: vi.fn(),
    querySourceFeatures: vi.fn((_id: string, opts?: { filter?: unknown[] }) => {
      const filter = opts?.filter
      if (Array.isArray(filter) && filter[0] === 'has' && filter[1] === 'point_count')
        return clusterFeatures
      return individualFeatures
    }),
    emit: (event: string, ...args: unknown[]) => {
      for (const handler of listeners[event] ?? [])
        handler(...args)
    },
  }
}

// Mock maplibre-gl Marker
vi.mock('maplibre-gl', () => {
  const Marker = vi.fn().mockImplementation(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: vi.fn(() => document.createElement('div')),
  }))
  return {
    default: { Marker },
    Marker,
  }
})

describe('useToursMarkerLayer — cluster diffing', () => {
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
})

describe('useToursMarkerLayer — reduced motion gate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not run animations when prefers-reduced-motion is set', async () => {
    // Stub matchMedia to report reduced motion
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

    // Trigger zoomend — should not create temp markers (reducedMotion=true)
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    ;(map as ReturnType<typeof makeStubMap>).emit('zoomend')

    // Give async time to settle
    await new Promise(r => setTimeout(r, 10))

    expect(rafSpy).not.toHaveBeenCalled()
    matchMediaSpy.mockRestore()
  })
})
