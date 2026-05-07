import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { TourType } from '@/features/tours/data/models/tour-type'
import maplibregl from 'maplibre-gl'
import { TOUR_TYPE_COLORS } from '@/features/tours/data/models/tour-type'

const SPIDERFY_CIRCLE_RADIUS_PX = 32
const SPIDERFY_SPIRAL_THRESHOLD = 8
const SPIDERFY_SPIRAL_A = 28
const SPIDERFY_SPIRAL_B = 5

const SPIDERFY_SOURCE_ID = 'cluster-spiderfy-lines'
const SPIDERFY_LAYER_ID = 'cluster-spiderfy-lines'

export interface SpiderfyLeaf {
  id: string
  tourType: TourType | null
}

export function computeLeafPositions(count: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = []
  if (count <= SPIDERFY_SPIRAL_THRESHOLD) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
      offsets.push([
        SPIDERFY_CIRCLE_RADIUS_PX * Math.cos(angle),
        SPIDERFY_CIRCLE_RADIUS_PX * Math.sin(angle),
      ])
    }
  }
  else {
    const angleStep = (2 * Math.PI) / 6
    let theta = 0
    for (let i = 0; i < count; i++) {
      const r = SPIDERFY_SPIRAL_A + SPIDERFY_SPIRAL_B * theta
      offsets.push([r * Math.cos(theta), r * Math.sin(theta)])
      theta += angleStep
    }
  }
  return offsets
}

export interface Spiderfier {
  setup: () => void
  teardown: () => void
  spiderfy: (
    clusterId: string,
    centroid: [number, number],
    leaves: SpiderfyLeaf[],
    spiderfyHint: string,
    onTourClick: (id: string) => void,
  ) => void
  collapse: () => void
  isActive: () => boolean
  getActiveClusterId: () => string | null
}

export function createSpiderfier(map: MapLibreMap): Spiderfier {
  let activeClusterId: string | null = null
  const leafMarkers: maplibregl.Marker[] = []
  let restoreFocusEl: HTMLElement | null = null

  function setup(): void {
    map.addSource(SPIDERFY_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: SPIDERFY_LAYER_ID,
      type: 'line',
      source: SPIDERFY_SOURCE_ID,
      paint: {
        'line-color': '#94a3b8',
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    })
  }

  function teardown(): void {
    collapse()
    if (map.getLayer(SPIDERFY_LAYER_ID))
      map.removeLayer(SPIDERFY_LAYER_ID)
    if (map.getSource(SPIDERFY_SOURCE_ID))
      map.removeSource(SPIDERFY_SOURCE_ID)
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape')
      collapse()
  }

  function collapse(): void {
    if (activeClusterId == null)
      return

    for (const m of leafMarkers)
      m.remove()
    leafMarkers.length = 0

    const src = map.getSource(SPIDERFY_SOURCE_ID) as GeoJSONSource | undefined
    if (src)
      src.setData({ type: 'FeatureCollection', features: [] })

    document.removeEventListener('keydown', onEscape)

    const toFocus = restoreFocusEl
    restoreFocusEl = null
    activeClusterId = null

    if (toFocus)
      requestAnimationFrame(() => toFocus.focus())
  }

  function spiderfy(
    clusterId: string,
    centroid: [number, number],
    leaves: SpiderfyLeaf[],
    spiderfyHint: string,
    onTourClick: (id: string) => void,
  ): void {
    if (activeClusterId === clusterId)
      return
    collapse()

    activeClusterId = clusterId
    restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const offsets = computeLeafPositions(leaves.length)
    const centroidPx = map.project(centroid as maplibregl.LngLatLike)
    const lineFeatures: GeoJSON.Feature[] = []

    leaves.forEach((leaf, i) => {
      const offset = offsets[i] ?? [0, 0]
      const px = { x: centroidPx.x + offset[0], y: centroidPx.y + offset[1] }
      const projected = map.unproject([px.x, px.y])
      const leafLngLat: [number, number] = [projected.lng, projected.lat]

      const color = leaf.tourType ? (TOUR_TYPE_COLORS[leaf.tourType] ?? '#78716C') : '#78716C'
      const el = document.createElement('div')
      el.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};opacity:0.9;cursor:pointer;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);`
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '0')
      el.setAttribute('aria-label', leaf.id)
      el.setAttribute('aria-describedby', spiderfyHint)

      const onClick = () => {
        collapse()
        onTourClick(leaf.id)
      }
      el.addEventListener('click', onClick)
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(leafLngLat)
        .addTo(map)
      leafMarkers.push(marker)

      lineFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [centroid, leafLngLat] },
        properties: {},
      })
    })

    const src = map.getSource(SPIDERFY_SOURCE_ID) as GeoJSONSource | undefined
    if (src)
      src.setData({ type: 'FeatureCollection', features: lineFeatures })

    if (leafMarkers.length > 0) {
      const firstEl = leafMarkers[0]!.getElement()
      requestAnimationFrame(() => firstEl.focus())
    }

    document.addEventListener('keydown', onEscape)
  }

  function isActive(): boolean {
    return activeClusterId != null
  }

  function getActiveClusterId(): number | null {
    return activeClusterId
  }

  return { setup, teardown, spiderfy, collapse, isActive, getActiveClusterId }
}
